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
type OrderReceiptView = Order & { statusText: string; lines: OrderReceiptLine[]; queueNo?: number }

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

    const raw = order as unknown as { status?: string; queueNo?: number; storeName?: string }
    const statusCode = raw.status || 'submitted'
    /* 新状态机映射（含旧版兼容） */
    const STATUS_TEXT: Record<string, string> = {
      submitted: '已下单',
      preparing: '制作中',
      completed: '已完成',
      cancelled: '已取消',
      PENDING_PAY: '待支付',
      PAID: '已下单·排队中',
      PREPARING: '制作中',
      COMPLETED: '已完成',
    }
    const done = statusCode === 'completed' || statusCode === 'COMPLETED'
    const paidStep = statusCode !== 'PENDING_PAY' && statusCode !== 'submitted'
    const statusSteps = [
      { label: '已下单', active: true },
      { label: '已支付', active: paidStep },
      { label: done ? '已完成' : statusCode === 'PREPARING' || statusCode === 'preparing' ? '制作中' : '等候出餐', active: paidStep },
    ]

    this.setData({
      order: {
        ...order,
        statusText: STATUS_TEXT[statusCode] || '已下单',
        queueNo: raw.queueNo,
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
