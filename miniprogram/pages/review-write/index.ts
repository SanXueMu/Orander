import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { submitReviewCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    orderId: '',
    rating: 5,
    stars: [1, 2, 3, 4, 5],
    content: '',
    submitting: false,
    ratingTexts: ['', '很差', '一般', '不错', '满意', '超赞'],
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({ orderId: query.orderId || '' })
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
  },

  setStar(event: WechatMiniprogram.BaseEvent) {
    this.setData({ rating: Number(event.currentTarget.dataset.star) || 5 })
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value })
  },

  async submit() {
    if (this.data.submitting) return
    if (!this.data.orderId) {
      wx.showToast({ title: '缺少订单信息', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await submitReviewCloud({ orderId: this.data.orderId, rating: this.data.rating, content: this.data.content.trim() })
      wx.showToast({ title: '感谢评价', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (error) {
      wx.showToast({ title: (error as Error).message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
