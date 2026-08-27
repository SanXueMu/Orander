/**
 * payment 域：支付记录查询 / 退款审核（个人主体无商户号 → 全程模拟）
 */
const { col, generateId, nowIso } = require('../lib/context')
const notify = require('./notify')

module.exports = {
  async listPayments(event = {}) {
    const result = await col('payments').orderBy('paidAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  async listRefunds(event = {}) {
    const result = await col('refunds').orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  /* 退款审核（admin）：同意 → 订单 REFUNDED + 通知；驳回 → 回 PAID */
  async reviewRefund(event = {}) {
    const result = await col('refunds').where({ id: event.refundId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('退款单不存在')
    }
    const refund = result.data[0]
    if (refund.status !== 'PENDING') {
      throw new Error('该退款单已处理')
    }

    const approve = !!event.approve
    await col('refunds').where({ id: refund.id }).update({
      data: {
        status: approve ? 'REFUNDED' : 'REJECTED',
        reviewedAt: nowIso(),
        reviewNote: event.note || '',
      },
    })
    await col('orders').where({ id: refund.orderId }).update({
      data: { status: approve ? 'REFUNDED' : 'PAID' },
    })
    await notify.push(
      'refund',
      approve ? '退款成功' : '退款被驳回',
      approve ? `订单 ${refund.orderNumber} 的退款已原路退回（模拟）` : `订单 ${refund.orderNumber} 的退款申请未通过`,
      { toOpenId: refund.openId },
    )
    return { id: refund.id, status: approve ? 'REFUNDED' : 'REJECTED' }
  },
}
