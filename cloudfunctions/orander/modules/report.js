/**
 * report 域：管理端看板聚合（今日概览 / 7 日趋势 / 待办 / 漏斗近似）
 */
const { col, parsePagination } = require('../lib/context')
const { mapOrder } = require('./trade')

module.exports = {
  async getDashboard() {
    const [orderResult, refundResult, activityResult, sessionResult] = await Promise.all([
      col('orders').orderBy('createdAt', 'desc').limit(500).get(),
      col('refunds').where({ status: 'PENDING' }).limit(100).get(),
      col('activities').where({ status: 'ON' }).limit(20).get(),
      col('cs_sessions').where({ status: 'OPEN' }).limit(100).get(),
    ])
    const orders = orderResult.data.map(mapOrder)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((order) => new Date(order.createdAt) >= startOfToday)

    const daily = []
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - offset)
      const next = new Date(day)
      next.setDate(day.getDate() + 1)
      const dayOrders = orders.filter((order) => {
        const time = new Date(order.createdAt)
        return time >= day && time < next
      })
      daily.push({
        date: `${day.getMonth() + 1}/${day.getDate()}`,
        orders: dayOrders.length,
        gmv: Number(dayOrders.reduce((sum, order) => sum + order.payAmount, 0).toFixed(2)),
      })
    }

    const dishSales = {}
    orders.forEach((order) => {
      ;(order.items || []).forEach((item) => {
        if (!dishSales[item.spuId]) {
          dishSales[item.spuId] = { spuId: item.spuId, name: item.name, quantity: 0, revenue: 0 }
        }
        dishSales[item.spuId].quantity += item.qty || item.quantity || 0
        dishSales[item.spuId].revenue += item.subtotal || 0
      })
    })
    const topDishes = Object.values(dishSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    const paid = orders.filter((order) => order.status !== 'PENDING_PAY' && order.status !== 'CANCELLED').length
    return {
      today: {
        gmv: Number(todayOrders.reduce((sum, order) => sum + order.payAmount, 0).toFixed(2)),
        orders: todayOrders.length,
        pendingPrepare: orders.filter((order) => ['PAID'].includes(order.status)).length,
        making: orders.filter((order) => ['PREPARING', 'preparing'].includes(order.status)).length,
      },
      total: {
        orders: orders.length,
        gmv: Number(orders.reduce((sum, order) => sum + order.payAmount, 0).toFixed(2)),
        members: new Set(orders.map((order) => order.openId).filter(Boolean)).size,
      },
      todos: {
        pendingRefunds: refundResult.data.length,
        runningActivities: activityResult.data.length,
        openSessions: sessionResult.data.length,
      },
      funnel: {
        visits: Math.max(orders.length * 8, 100),
        orders: paid,
        conversion: paid > 0 ? Number((paid / Math.max(orders.length * 8, 100) * 100).toFixed(1)) : 0,
      },
      daily,
      topDishes,
    }
  },

  /* 旧 action 兼容：订单统计（家宴语义字段保留） */
  async getOrderStats() {
    const result = await col('orders').limit(100).orderBy('createdAt', 'desc').get()
    const orders = result.data.map(mapOrder)

    const revenue = orders.reduce((sum, order) => sum + order.total, 0)
    const completedCount = orders.filter((order) => ['completed', 'COMPLETED'].includes(order.status)).length
    const submittedCount = orders.filter((order) => ['submitted'].includes(order.status)).length

    const dishSales = {}
    orders.forEach((order) => {
      ;(order.items || []).forEach((item) => {
        const qty = item.quantity != null ? item.quantity : item.qty
        if (!dishSales[item.dishId || item.spuId]) {
          dishSales[item.dishId || item.spuId] = { dishId: item.dishId || item.spuId, name: item.name, quantity: 0, revenue: 0 }
        }
        dishSales[item.dishId || item.spuId].quantity += qty || 0
        dishSales[item.dishId || item.spuId].revenue += item.subtotal || 0
      })
    })

    const topDishes = Object.values(dishSales)
      .map((dish) => ({ ...dish, revenue: Number(dish.revenue.toFixed(2)) }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 10)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((order) => new Date(order.createdAt) >= startOfToday)

    const daily = []
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - offset)
      const next = new Date(day)
      next.setDate(day.getDate() + 1)
      const dayOrders = orders.filter((order) => {
        const time = new Date(order.createdAt)
        return time >= day && time < next
      })
      daily.push({
        date: `${day.getMonth() + 1}/${day.getDate()}`,
        orders: dayOrders.length,
        revenue: Number(dayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
      })
    }

    return {
      totalOrders: orders.length,
      completedCount,
      submittedCount,
      revenue: Number(revenue.toFixed(2)),
      today: {
        orders: todayOrders.length,
        revenue: Number(todayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
        submitted: todayOrders.filter((order) => order.status === 'submitted').length,
        visitors: new Set(todayOrders.map((order) => order.memberId)).size,
        dishes: todayOrders.reduce((sum, order) => sum + (order.items || []).reduce((total, item) => total + (item.quantity != null ? item.quantity : item.qty || 0), 0), 0),
      },
      daily,
      topDishes,
    }
  },

  /* 会员花名册带统计（旧 listMembers 增强版给 admin 用） */
  async listMembersWithStats() {
    const [memberResult, orderResult] = await Promise.all([
      col('members').limit(100).get(),
      col('orders').limit(500).get(),
    ])
    return memberResult.data.map((member) => {
      const related = orderResult.data.filter((order) => order.memberId === member.id)
      return {
        ...member,
        ordersCount: related.length,
        lastOrderAt: related.length ? related.map((o) => o.createdAt).sort().pop() : member.joinedAt,
      }
    })
  },
}
