import {
  formatMoney,
  formatShortDate,
  getCurrentMember,
  getOrdersForCurrentMember,
  isVisitorSession,
} from '../../utils/orander'
import type { Member } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

const mapOrders = () => {
  return getOrdersForCurrentMember().map((order) => ({
    ...order,
    totalText: formatMoney(order.total),
    createdText: formatShortDate(order.createdAt),
    statusText: order.status === 'completed' ? '已完成' : '已提交',
    previewText: order.items.slice(0, 3).map((item) => item.name).join(' · '),
    reviewText: order.review ? `${order.review.rating} 星评价` : order.status === 'completed' ? '待评价' : '待完成后评价',
  }))
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    profile: null as Member | null,
    orders: [] as Array<Record<string, unknown>>,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    const profile = getCurrentMember()
    applyPageLook(this, profile)

    this.setData({
      profile,
      orders: mapOrders(),
    })
  },

  openOrder(event: WechatMiniprogram.BaseEvent) {
    const orderId = event.currentTarget.dataset.id as string
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${orderId}`,
    })
  },

  goMenu() {
    wx.reLaunch({
      url: '/pages/index/index',
    })
  },
})
