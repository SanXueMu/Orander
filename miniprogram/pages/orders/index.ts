import {
  buildPageLook,
  formatMoney,
  formatShortDate,
  getCurrentMember,
  getOrdersForCurrentMember,
} from '../../utils/orander'
import type { Member } from '../../utils/orander'

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
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#2b1d14',
    navBackground: '#f5eadc',
    profile: null as Member | null,
    orders: [] as Array<Record<string, unknown>>,
  },

  onShow() {
    const profile = getCurrentMember()
    const pageLook = buildPageLook(profile)

    this.setData({
      ...pageLook,
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
