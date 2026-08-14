import {
  formatMoney,
  formatReceiptDate,
  getCurrentMember,
  getOrderById,
  saveReview,
} from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

const getOrderView = (orderId: string) => {
  const order = getOrderById(orderId)
  if (!order) {
    return null
  }

  return {
    ...order,
    totalText: formatMoney(order.total),
    receiptDate: formatReceiptDate(order.createdAt),
    statusText: order.status === 'completed' ? '已完成' : '已提交',
    lines: order.items.map((item) => ({
      ...item,
      priceText: formatMoney(item.price),
      subtotalText: formatMoney(item.subtotal),
    })),
  }
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    order: null as Record<string, unknown> | null,
    ratingOptions: [1, 2, 3, 4, 5],
    rating: 5,
    comment: '',
  },

  onLoad(options: Record<string, string>) {
    this.loadOrder(options.id || '')
  },

  loadOrder(orderId: string) {
    const profile = getCurrentMember()
    const order = getOrderView(orderId)

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none',
      })
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
        })
      }, 600)
      return
    }

    applyPageLook(this, profile)

    this.setData({
      order,
      rating: order.review ? order.review.rating : 5,
      comment: order.review ? order.review.comment : '',
    })
  },

  chooseRating(event: WechatMiniprogram.BaseEvent) {
    const rating = Number(event.currentTarget.dataset.rating)
    this.setData({
      rating,
    })
  },

  onCommentInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({
      comment: detail.value || '',
    })
  },

  submitReview() {
    const order = this.data.order as { id: string; status: string } | null
    if (!order) {
      return
    }

    if (order.status !== 'completed') {
      wx.showToast({
        title: '等订单完成后再评价',
        icon: 'none',
      })
      return
    }

    const comment = this.data.comment.trim()
    const nextOrder = saveReview(order.id, this.data.rating, comment)
    if (!nextOrder) {
      return
    }

    this.loadOrder(order.id)
    wx.showToast({
      title: '评价已保存',
      icon: 'success',
    })
  },
})
