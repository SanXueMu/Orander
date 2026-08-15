import { getBusinessStatusCloud, initCloud } from '../../utils/cloud'
import {
  formatMoney,
  formatShortDate,
  getCurrentMember,
  getLastOrderId,
  getOrderById,
  isVisitorSession,
} from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import type { Order, OrderItem } from '../../utils/orander'

type OrderReceiptLine = OrderItem & { priceText: string; subtotalText: string }
type OrderReceiptView = Order & { statusText: string; lines: OrderReceiptLine[] }

Page({
  behaviors: [pageLookBehavior],

  data: {
    order: null as OrderReceiptView | null,
    statusSteps: [] as Array<{ label: string; active: boolean }>,
    totalText: formatMoney(0),
    createdText: '',
    chefName: 'Orander 私厨',
  },

  onLoad(options: Record<string, string>) {
    const orderId = options.id || getLastOrderId()
    this.loadOrder(orderId)

    /* 掌勺署名：云端营业配置里的 chefName（管理员端可设），缺省品牌署名 */
    if (initCloud()) {
      getBusinessStatusCloud().then((status) => {
        if (status && status.chefName) {
          this.setData({ chefName: status.chefName })
        }
      })
    }
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

    applyPageLook(this, getCurrentMember())

    const completed = order.status === 'completed'
    const statusSteps = [
      { label: '已下单', active: true },
      { label: '账单确认', active: true },
      { label: completed ? '已完成' : '等候中', active: completed },
    ]

    this.setData({
      order: {
        ...order,
        statusText: completed ? '已完成' : '制作中',
        lines: order.items.map((item) => ({
          ...item,
          priceText: formatMoney(item.price),
          subtotalText: formatMoney(item.subtotal),
        })),
      },
      statusSteps,
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
