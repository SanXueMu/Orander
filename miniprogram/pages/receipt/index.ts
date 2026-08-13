import {
  formatMoney,
  formatShortDate,
  getLastOrderId,
  getOrderById,
  isVisitorSession,
} from '../../utils/orander'

Page({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#111111',
    navBackground: '#f4f4f4',
    order: null as Record<string, unknown> | null,
    totalText: formatMoney(0),
    createdText: '',
  },

  onLoad(options: Record<string, string>) {
    const orderId = options.id || getLastOrderId()
    this.loadOrder(orderId)
  },

  loadOrder(orderId: string) {
    if (!isVisitorSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    const order = getOrderById(orderId)
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none',
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/dish/index',
        })
      }, 500)
      return
    }

    this.setData({
      order: {
        ...order,
        lines: order.items.map((item) => ({
          ...item,
          subtotalText: formatMoney(item.subtotal),
        })),
      },
      totalText: formatMoney(order.total),
      createdText: formatShortDate(order.createdAt),
    })
  },

  backMenu() {
    wx.redirectTo({
      url: '/pages/dish/index',
    })
  },

  goProfile() {
    wx.redirectTo({
      url: '/pages/profile/index',
    })
  },
})
