/**
 * invoice 域：可开票订单 / 申请开票（7 类业务线模拟）/ 抬头库 / 开票记录
 */
const { col, generateId, nowIso, openIdOf } = require('../lib/context')

const BIZ_TYPES = [
  { code: 'TEA', name: '茶饮订单' },
  { code: 'MALL', name: '百货商品' },
  { code: 'DELIVERY', name: '配送费' },
  { code: 'CARD', name: '金喜卡' },
  { code: 'WALLET', name: '钱包充值' },
  { code: 'GIFT', name: '礼品卡' },
  { code: 'GROUPMEAL', name: '团餐' },
]

module.exports = {
  BIZ_TYPES,

  async listInvoicableOrders() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('orders').where({ openId }).orderBy('createdAt', 'desc').limit(100).get()
    const invoiced = new Set(
      (await col('invoices').where({ openId }).limit(200).get()).data.map((doc) => doc.orderId),
    )
    const items = result.data
      .filter((order) => ['COMPLETED', 'completed'].includes(order.status))
      .filter((order) => !invoiced.has(order.id))
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        biz: order.biz || 'TEA',
        amount: Number(order.payAmount || order.total || 0),
        createdAt: order.createdAt,
      }))
    return { items, bizTypes: BIZ_TYPES }
  },

  async applyInvoice(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    if (!Array.isArray(event.orderIds) || event.orderIds.length === 0) {
      throw new Error('请选择要开票的订单')
    }
    const orderResult = await col('orders').where({ openId }).limit(200).get()
    const targets = orderResult.data.filter((order) => event.orderIds.includes(order.id))
    if (targets.length === 0) {
      throw new Error('订单不存在')
    }
    const amount = Number(targets.reduce((sum, order) => sum + Number(order.payAmount || order.total || 0), 0).toFixed(2))

    const invoice = {
      id: generateId('inv'),
      openId,
      orderIds: targets.map((order) => order.id),
      orderNumbers: targets.map((order) => order.orderNumber),
      amount,
      title: event.title || '个人',
      taxNo: event.taxNo || '',
      type: event.type || 'ELECTRONIC',
      status: 'PENDING',
      createdAt: nowIso(),
    }
    await col('invoices').add({ data: invoice })
    return invoice
  },

  async listTitles() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('invoice_titles').where({ openId }).limit(20).get()
    return { items: result.data }
  },

  async saveTitle(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const title = {
      id: (event.title && event.title.id) || generateId('ttl'),
      openId,
      name: (event.title && event.title.name) || '个人',
      taxNo: (event.title && event.title.taxNo) || '',
      isDefault: !!(event.title && event.title.isDefault),
      updatedAt: nowIso(),
    }
    const existing = await col('invoice_titles').where({ id: title.id }).limit(1).get()
    if (title.isDefault) {
      await col('invoice_titles').where({ openId }).update({ data: { isDefault: false } })
    }
    if (existing.data.length) {
      await col('invoice_titles').where({ id: title.id }).update({ data: title })
    } else {
      await col('invoice_titles').add({ data: title })
    }
    return title
  },

  async deleteTitle(event = {}) {
    const openId = openIdOf()
    await col('invoice_titles').where({ id: event.titleId, openId }).remove()
    return { id: event.titleId }
  },

  async listInvoiceRecords() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('invoices').where({ openId }).orderBy('createdAt', 'desc').limit(50).get()
    return { items: result.data }
  },

  /* ---- admin ---- */
  async listApplies() {
    const result = await col('invoices').orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  async issueInvoice(event = {}) {
    await col('invoices').where({ id: event.invoiceId }).update({
      data: { status: 'ISSUED', issuedAt: nowIso(), invoiceNo: `INV-${Date.now().toString().slice(-8)}` },
    })
    const notify = require('./notify')
    const result = await col('invoices').where({ id: event.invoiceId }).limit(1).get()
    if (result.data[0] && result.data[0].openId) {
      await notify.push('invoice', '发票已开具', `发票 ${result.data[0].invoiceNo} 可在记录中查看（模拟）`, { toOpenId: result.data[0].openId })
    }
    return { id: event.invoiceId, status: 'ISSUED' }
  },
}
