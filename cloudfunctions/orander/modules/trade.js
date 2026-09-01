/**
 * trade 域：订单试算 / 下单 / 状态机 / 排队号 / 旧订单动作兼容
 * 状态机：PENDING_PAY → PAID(取排队号) → PREPARING → COMPLETED
 *         PENDING_PAY/PAID → CANCELLED；PAID/PREPARING → REFUND_PENDING → REFUNDED/REJECTED
 * 旧状态（submitted/preparing/completed/cancelled）由旧 action 继续使用。
 */
const { col, generateId, generateOrderNumber, nowIso, openIdOf, nextCounter } = require('../lib/context')
const product = require('./product')
const notify = require('./notify')
const { addGrowth } = require('./member')

const mapOrder = (doc = {}) => ({
  id: doc.id,
  orderNumber: doc.orderNumber,
  biz: doc.biz || 'TEA',
  storeId: doc.storeId || '',
  memberId: doc.memberId,
  nickname: doc.nickname,
  openId: doc.openId || '',
  total: Number(doc.total || 0),
  discount: Number(doc.discount || 0),
  payAmount: Number(doc.payAmount || doc.total || 0),
  couponInstanceId: doc.couponInstanceId || '',
  note: doc.note || '',
  groupmeal: doc.groupmeal || null,
  status: doc.status || 'submitted',
  queueNo: doc.queueNo || 0,
  createdAt: doc.createdAt,
  items: Array.isArray(doc.items) ? doc.items : [],
  review: doc.review,
  paidAt: doc.paidAt || '',
  completedAt: doc.completedAt || '',
  refund: doc.refund || null,
})

const queueKeyOf = (storeId, date) => {
  const d = new Date()
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `queue:${storeId || 'default'}:${day}`
}

module.exports = {
  mapOrder,

  /* 下单前试算（服务端计价 + 券模拟由前端叠加展示） */
  async previewOrder(event = {}) {
    const priced = await product.priceItems(event.items || [])
    return {
      ...priced,
      deliveryFee: event.mode === 'DELIVERY' ? 6 : 0,
      payable: Number((priced.total + (event.mode === 'DELIVERY' ? 6 : 0)).toFixed(2)),
    }
  },

  /* 新下单：服务端计价，落 PENDING_PAY */
  async createOrderV2(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const priced = await product.priceItems(event.items || [])
    const deliveryFee = event.mode === 'DELIVERY' ? 6 : 0
    /* 团餐订单：校验档期余量并落档期标记（V1-U5） */
    let groupmeal = null
    if (event.groupmeal && event.groupmeal.slotId) {
      const gmResult = await col('gm_slots').where({ id: event.groupmeal.slotId }).limit(1).get()
      if (gmResult.data.length === 0) {
        throw new Error('团餐档期不存在')
      }
      const slot = gmResult.data[0]
      if (Number(slot.reserved || 0) >= Number(slot.capacity || 0)) {
        throw new Error('该时段余量不足，请更换时段')
      }
      groupmeal = { slotId: slot.id, date: slot.date, time: slot.time }
    }
    const order = {
      id: generateId('order'),
      orderNumber: generateOrderNumber(),
      biz: event.biz || 'TEA',
      storeId: event.storeId || '',
      mode: event.mode || 'PICKUP',
      memberId: `member-${openId}`,
      openId,
      nickname: event.nickname || '',
      total: priced.total,
      discount: 0,
      payAmount: Number((priced.total + deliveryFee).toFixed(2)),
      couponInstanceId: '',
      note: event.note || '',
      groupmeal,
      status: 'PENDING_PAY',
      queueNo: 0,
      items: priced.items,
      createdAt: nowIso(),
    }
    await col('orders').add({ data: order })
    return mapOrder(order)
  },

  /* 支付（模拟，个人主体无商户号）：置 PAID + 取排队号 + 推通知 */
  async payOrder(event = {}) {
    const openId = openIdOf()
    const result = await col('orders').where({ id: event.orderId, openId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    const order = result.data[0]
    if (order.status !== 'PENDING_PAY') {
      throw new Error('订单状态不可支付')
    }

    const payNo = generateId('pay')
    const queueNo = await nextCounter(queueKeyOf(order.storeId))

    await col('payments').add({
      data: {
        id: payNo,
        orderId: order.id,
        orderNumber: order.orderNumber,
        channel: 'MOCK',
        amount: order.payAmount,
        status: 'SUCCESS',
        paidAt: nowIso(),
      },
    })
    await col('orders').where({ id: order.id }).update({
      data: { status: 'PAID', queueNo, payNo, paidAt: nowIso() },
    })
    await notify.push('order', '支付成功', `排队号 ${queueNo}，等待制作`, { toOpenId: openId })

    return { ...mapOrder(order), status: 'PAID', queueNo, payNo }
  },

  async cancelOrder(event = {}) {
    const openId = openIdOf()
    const result = await col('orders').where({ id: event.orderId, openId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    const order = result.data[0]
    if (!['PENDING_PAY', 'PAID'].includes(order.status)) {
      throw new Error('当前状态不可取消')
    }
    await col('orders').where({ id: order.id }).update({
      data: { status: 'CANCELLED', cancelledAt: nowIso() },
    })
    return { id: order.id, status: 'CANCELLED' }
  },

  /* 退款申请（已支付订单） */
  async refundApply(event = {}) {
    const openId = openIdOf()
    const result = await col('orders').where({ id: event.orderId, openId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    const order = result.data[0]
    if (!['PAID', 'PREPARING'].includes(order.status)) {
      throw new Error('当前状态不可退款')
    }
    await col('refunds').add({
      data: {
        id: generateId('rf'),
        orderId: order.id,
        orderNumber: order.orderNumber,
        openId,
        amount: order.payAmount,
        reason: event.reason || '',
        status: 'PENDING',
        createdAt: nowIso(),
      },
    })
    await col('orders').where({ id: order.id }).update({
      data: { status: 'REFUND_PENDING' },
    })
    return { ok: true }
  },

  /* 制作开始（admin / 制作队列看板用） */
  async startPreparing(event = {}) {
    const result = await col('orders').where({ id: event.orderId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    if (result.data[0].status !== 'PAID') {
      throw new Error('仅已支付订单可开始制作')
    }
    await col('orders').where({ id: event.orderId }).update({
      data: { status: 'PREPARING', preparingAt: nowIso() },
    })
    await notify.push('order', '开始制作', `您的订单已进入制作`, { toOpenId: result.data[0].openId })
    return { id: event.orderId, status: 'PREPARING' }
  },

  /* 完成订单（admin）：加成长值 + 销量 */
  async completeOrder(event = {}) {
    const result = await col('orders').where({ id: event.orderId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    const order = result.data[0]
    if (order.status === 'COMPLETED') {
      return { id: order.id, status: 'COMPLETED' }
    }
    await col('orders').where({ id: order.id }).update({
      data: { status: 'COMPLETED', completedAt: nowIso() },
    })
    if (order.openId) {
      await addGrowth(order.openId, Math.max(1, Math.floor(order.payAmount)), '订单完成')
    }
    for (const item of order.items || []) {
      try {
        const spuResult = await col('spus').where({ id: item.spuId }).limit(1).get()
        if (spuResult.data.length) {
          const sold = Number(spuResult.data[0].soldCount || 0)
          await col('spus').where({ id: item.spuId }).update({ data: { soldCount: sold + item.qty } })
        }
      } catch (error) {
        /* 销量统计失败不影响主流程 */
      }
    }
    await notify.push('order', '订单完成', '茶已备好，欢迎取用', { toOpenId: order.openId })
    return { id: order.id, status: 'COMPLETED' }
  },

  async getMyOrders(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('orders').where({ openId }).orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data.map(mapOrder) }
  },

  async getOrderDetail(event = {}) {
    const result = await col('orders').where({ id: event.orderId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('订单不存在')
    }
    return mapOrder(result.data[0])
  },

  async getQueue(event = {}) {
    const key = queueKeyOf(event.storeId)
    const result = await col('counters').where({ key }).limit(1).get()
    const current = result.data.length ? Number(result.data[0].value) : 0
    const making = await col('orders').where({ storeId: event.storeId || '', status: 'PREPARING' }).count()
    return { today: current, making: making.total }
  },

  /* ---- 旧 action 兼容（R2 前端切新后退役） ---- */
  async createOrder(event = {}) {
    const createdAt = nowIso()
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
    await col('orders').add({ data: order })
    return mapOrder(order)
  },

  async listMemberOrders(event = {}) {
    const result = await col('orders').where({ memberId: event.memberId }).limit(200).get()
    return result.data.map(mapOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async listAllOrders(event = {}) {
    const { page, pageSize, skip } = require('../lib/context').parsePagination(event)
    const countResult = await col('orders').count()
    const result = await col('orders').orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
    return {
      items: result.data.map(mapOrder),
      total: countResult.total,
      page,
      pageSize,
    }
  },

  async updateOrderStatus(event = {}) {
    const allowed = ['submitted', 'preparing', 'completed', 'cancelled']
    const nextStatus = allowed.includes(event.status) ? event.status : 'submitted'
    const target = nextStatus === 'completed' ? await col('orders').where({ id: event.orderId }).limit(1).get() : null
    await col('orders').where({ id: event.orderId }).update({
      data: { status: nextStatus },
    })
    const result = await col('orders').where({ id: event.orderId }).limit(1).get()
    if (nextStatus === 'completed' && result.data[0] && result.data[0].openId && !result.data[0].completedAt) {
      await col('orders').where({ id: event.orderId }).update({ data: { completedAt: nowIso() } })
      await addGrowth(result.data[0].openId, Math.max(1, Math.floor(Number(result.data[0].payAmount || result.data[0].total || 0))), '订单完成')
    }
    return mapOrder(result.data[0])
  },
}
