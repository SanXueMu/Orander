const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

const collections = {
  dishes: db.collection('dishes'),
  members: db.collection('members'),
  orders: db.collection('orders'),
  config: db.collection('config'),
}

// ============================
// 常量
// ============================

const ADMIN_PASSWORD_KEY = 'adminPassword'
const BUSINESS_STATUS_KEY = 'businessStatus'
const DEFAULT_ADMIN_PASSWORD = 'orander2026'
const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

// ============================
// 工具函数
// ============================

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(`orander-salt::${password}`).digest('hex')
}

const generateId = (prefix) => {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${random}`
}

const generateOrderNumber = () => {
  const ts = Date.now().toString().slice(-8)
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `OR-${ts}${rand}`
}

const parsePagination = (event) => {
  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(event.pageSize) || PAGE_SIZE_DEFAULT))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

const ok = (data) => ({ ok: true, data })
const fail = (message) => ({ ok: false, data: null, message })
const log = (action, message) => {
  console.log(`[orander:${action}] ${message}`)
}

// ============================
// 鉴权
// ============================

const ensureAdminConfig = async () => {
  const existing = await collections.config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  if (existing.data.length === 0) {
    await collections.config.add({
      data: {
        key: ADMIN_PASSWORD_KEY,
        value: hashPassword(DEFAULT_ADMIN_PASSWORD),
        updatedAt: new Date().toISOString(),
      },
    })
  }

  const result = await collections.config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  return result.data[0].value
}

// ============================
// Mapper
// ============================

const mapDish = (doc = {}) => ({
  id: doc.id,
  name: doc.name || '',
  category: doc.category || '',
  price: Number(doc.price || 0),
  description: doc.description || '',
  image: doc.image || '',
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  featured: !!doc.featured,
  soldOut: !!doc.soldOut,
})

const mapMember = (doc = {}) => ({
  id: doc.id,
  nickname: doc.nickname || '',
  avatarUrl: doc.avatarUrl || '',
  relation: doc.relation || '访客',
  customRelation: doc.customRelation || '',
  themeId: doc.themeId || 'amber',
  fontId: doc.fontId || 'modern',
  joinedAt: doc.joinedAt || new Date().toISOString(),
})

const mapOrder = (doc = {}) => ({
  id: doc.id,
  orderNumber: doc.orderNumber,
  memberId: doc.memberId,
  nickname: doc.nickname,
  relationLabel: doc.relationLabel,
  total: Number(doc.total || 0),
  note: doc.note || '',
  status: doc.status || 'submitted',
  createdAt: doc.createdAt,
  items: Array.isArray(doc.items) ? doc.items : [],
  review: doc.review,
})

// ============================
// Sorter
// ============================

const sortDishes = (dishes) => {
  return [...dishes].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1
    }
    if (left.category !== right.category) {
      return String(left.category).localeCompare(String(right.category), 'zh-Hans-CN')
    }
    return String(left.name).localeCompare(right.name)
  })
}

const sortMembers = (members) => {
  return [...members].sort((left, right) => {
    return new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime()
  })
}

const sortOrdersDesc = (orders) => {
  return [...orders].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

// ============================
// Action Handlers
// ============================

const actions = {
  // --- 鉴权 ---

  async verifyAdmin(event) {
    const storedHash = await ensureAdminConfig()
    if (hashPassword(event.password || '') !== storedHash) {
      throw new Error('密码错误')
    }
    return { adminToken: storedHash }
  },

  async changeAdminPassword(event) {
    const storedHash = await ensureAdminConfig()
    if ((event.adminToken || '') !== storedHash) {
      throw new Error('未授权')
    }
    if (!(event.newPassword || '').trim()) {
      throw new Error('密码不能为空')
    }

    const newHash = hashPassword(event.newPassword)
    await collections.config.where({ key: ADMIN_PASSWORD_KEY }).update({
      data: { value: newHash, updatedAt: new Date().toISOString() },
    })
    return { adminToken: newHash }
  },

  // --- 菜品 ---

  async bootstrap(event) {
    const dishes = event.dishes || []
    const existing = await collections.dishes.limit(1).get()
    if (existing.data.length === 0 && dishes.length) {
      await Promise.all(
        dishes.map((dish) => collections.dishes.add({
          data: {
            ...mapDish(dish),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })),
      )
    }
    const result = await collections.dishes.limit(100).get()
    return sortDishes(result.data.map(mapDish))
  },

  async listDishes() {
    const result = await collections.dishes.limit(100).get()
    return sortDishes(result.data.map(mapDish))
  },

  async saveDish(event) {
    const nextDish = {
      ...mapDish(event.dish || {}),
      updatedAt: new Date().toISOString(),
    }

    const current = await collections.dishes.where({ id: nextDish.id }).limit(1).get()
    if (current.data.length) {
      await collections.dishes.where({ id: nextDish.id }).update({ data: nextDish })
    } else {
      await collections.dishes.add({
        data: { ...nextDish, createdAt: new Date().toISOString() },
      })
    }
    return mapDish(nextDish)
  },

  async deleteDish(event) {
    await collections.dishes.where({ id: event.dishId }).remove()
    return { id: event.dishId }
  },

  // --- 访客 ---

  async syncVisitor(event) {
    const wxContext = cloud.getWXContext()
    const openId = wxContext.OPENID
    if (!openId) {
      throw new Error('无法获取用户身份')
    }

    const memberId = `member-${openId}`
    const current = await collections.members.where({ id: memberId }).limit(1).get()
    const nextMember = {
      id: memberId,
      openId,
      nickname: event.nickname || '访客',
      avatarUrl: event.avatarUrl || '',
      relation: '访客',
      customRelation: '',
      themeId: 'amber',
      fontId: 'modern',
      joinedAt: current.data.length ? current.data[0].joinedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (current.data.length) {
      await collections.members.where({ id: memberId }).update({ data: nextMember })
    } else {
      await collections.members.add({ data: nextMember })
    }
    return mapMember(nextMember)
  },

  // --- 会员 ---

  async listMembers() {
    const [memberResult, orderResult] = await Promise.all([
      collections.members.limit(100).get(),
      collections.orders.limit(200).get(),
    ])

    const orders = orderResult.data.map(mapOrder)

    return sortMembers(memberResult.data.map(mapMember)).map((member) => {
      const relatedOrders = orders.filter((order) => order.memberId === member.id)
      const latestOrder = sortOrdersDesc(relatedOrders)[0]

      return {
        ...member,
        ordersCount: relatedOrders.length,
        lastOrderAt: latestOrder ? latestOrder.createdAt : member.joinedAt,
      }
    })
  },

  async deleteMember(event) {
    await Promise.all([
      collections.members.where({ id: event.memberId }).remove(),
      collections.orders.where({ memberId: event.memberId }).remove(),
    ])
    return { id: event.memberId }
  },

  // --- 订单 ---

  async createOrder(event) {
    const createdAt = new Date().toISOString()
    const order = {
      id: generateId('order'),
      orderNumber: generateOrderNumber(),
      memberId: event.memberId,
      nickname: event.nickname,
      relationLabel: event.relationLabel,
      total: Number(event.total || 0),
      note: event.note || '',
      status: 'submitted',
      createdAt,
      items: Array.isArray(event.items) ? event.items : [],
    }

    await collections.orders.add({ data: order })
    return mapOrder(order)
  },

  async listMemberOrders(event) {
    const result = await collections.orders.where({ memberId: event.memberId }).limit(200).get()
    return sortOrdersDesc(result.data.map(mapOrder))
  },

  async listAllOrders(event) {
    const { page, pageSize, skip } = parsePagination(event)

    const countResult = await collections.orders.count()
    const total = countResult.total

    const result = await collections.orders
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      items: result.data.map(mapOrder),
      total,
      page,
      pageSize,
    }
  },

  async updateOrderStatus(event) {
    const nextStatus = event.status === 'completed' ? 'completed' : 'submitted'
    await collections.orders.where({ id: event.orderId }).update({
      data: { status: nextStatus },
    })

    const result = await collections.orders.where({ id: event.orderId }).limit(1).get()
    return mapOrder(result.data[0])
  },

  // --- 营业状态 ---

  async getBusinessStatus() {
    const result = await collections.config.where({ key: BUSINESS_STATUS_KEY }).limit(1).get()
    if (result.data.length === 0) {
      return { open: true }
    }
    return { open: !!result.data[0].open }
  },

  async setBusinessStatus(event) {
    const open = !!event.open
    const existing = await collections.config.where({ key: BUSINESS_STATUS_KEY }).limit(1).get()
    if (existing.data.length === 0) {
      await collections.config.add({
        data: { key: BUSINESS_STATUS_KEY, open, updatedAt: new Date().toISOString() },
      })
    } else {
      await collections.config.where({ key: BUSINESS_STATUS_KEY }).update({
        data: { open, updatedAt: new Date().toISOString() },
      })
    }
    return { open }
  },

  // --- 统计 ---

  async getOrderStats() {
    const result = await collections.orders.limit(100).orderBy('createdAt', 'desc').get()
    const orders = result.data.map(mapOrder)

    const revenue = orders.reduce((sum, order) => sum + order.total, 0)
    const completedCount = orders.filter((order) => order.status === 'completed').length
    const submittedCount = orders.filter((order) => order.status === 'submitted').length

    const dishSales = {}
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!dishSales[item.dishId]) {
          dishSales[item.dishId] = { dishId: item.dishId, name: item.name, quantity: 0, revenue: 0 }
        }
        dishSales[item.dishId].quantity += item.quantity
        dishSales[item.dishId].revenue += item.subtotal
      })
    })

    const topDishes = Object.values(dishSales)
      .map((dish) => ({
        ...dish,
        revenue: Number(dish.revenue.toFixed(2)),
      }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 10)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const todayOrders = orders.filter((order) => new Date(order.createdAt) >= startOfToday)

    const today = {
      orders: todayOrders.length,
      revenue: Number(todayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
      submitted: todayOrders.filter((order) => order.status === 'submitted').length,
    }

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
      today,
      daily,
      topDishes,
    }
  },
}

// ============================
// 需要管理员鉴权的 action
// ============================

const ADMIN_ONLY = new Set([
  'changeAdminPassword',
  'saveDish',
  'deleteDish',
  'deleteMember',
  'updateOrderStatus',
  'setBusinessStatus',
])

// ============================
// 主入口
// ============================

exports.main = async (event = {}) => {
  const { action } = event
  const handler = actions[action]

  if (!handler) {
    return fail('unknown action')
  }

  try {
    if (ADMIN_ONLY.has(action)) {
      const expectedToken = await ensureAdminConfig()
      if ((event.adminToken || '') !== expectedToken) {
        log(action, 'unauthorized')
        return fail('未授权的管理操作')
      }
    }

    log(action, 'start')
    const result = await handler(event)
    log(action, 'done')
    return ok(result)
  } catch (error) {
    log(action, `error: ${error.message}`)
    return fail(error.message || 'cloud error')
  }
}
