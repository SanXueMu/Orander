/**
 * review 域：订单评价（星级/图文）/ 我的评价 / 后台审核
 */
const { col, generateId, nowIso, openIdOf } = require('../lib/context')

module.exports = {
  async submitReview(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const orderResult = await col('orders').where({ id: event.orderId, openId }).limit(1).get()
    if (orderResult.data.length === 0) {
      throw new Error('订单不存在')
    }
    const order = orderResult.data[0]
    if (order.status !== 'COMPLETED' && order.status !== 'completed') {
      throw new Error('订单完成后才能评价')
    }

    const review = {
      id: generateId('rv'),
      orderId: order.id,
      openId,
      nickname: event.nickname || '',
      rating: Math.max(1, Math.min(5, Number(event.rating) || 5)),
      content: String(event.content || '').slice(0, 500),
      images: Array.isArray(event.images) ? event.images.slice(0, 6) : [],
      status: 'PENDING',
      createdAt: nowIso(),
    }
    await col('reviews').add({ data: review })
    await col('orders').where({ id: order.id }).update({
      data: { review: { rating: review.rating, content: review.content, at: review.createdAt } },
    })
    return review
  },

  async listMyReviews() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('reviews').where({ openId }).orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  /* ---- admin ---- */
  async listReviews(event = {}) {
    const result = await col('reviews').orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  async moderateReview(event = {}) {
    const nextStatus = ['APPROVED', 'REJECTED'].includes(event.status) ? event.status : 'APPROVED'
    await col('reviews').where({ id: event.reviewId }).update({
      data: { status: nextStatus, moderatedAt: nowIso() },
    })
    return { id: event.reviewId, status: nextStatus }
  },

  async replyReview(event = {}) {
    await col('reviews').where({ id: event.reviewId }).update({
      data: { reply: event.reply || '', repliedAt: nowIso() },
    })
    return { id: event.reviewId, reply: event.reply || '' }
  },
}
