import {
  formatMoney,
  formatReceiptDate,
  getCurrentMember,
  getOrderById,
  cacheOrder,
  saveReview,
} from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import type { Order, OrderItem } from '../../utils/orander'
import {
  initCloud,
  payOrderCloud,
  refundApplyCloud,
} from '../../utils/cloud'

/* 新旧状态统一映射（与订单列表一致） */
const STATUS_META: Record<string, string> = {
  submitted: '已提交',
  preparing: '制作中',
  completed: '已完成',
  cancelled: '已取消',
  PENDING_PAY: '待支付',
  PAID: '已下单·排队中',
  PREPARING: '制作中',
  COMPLETED: '已完成',
  REFUND_PENDING: '退款审核中',
  REFUNDED: '已退款',
}

/* 状态时间线：已完成步骤高亮 */
const TIMELINE_STEPS = [
  { code: 'PENDING_PAY', label: '提交订单' },
  { code: 'PAID', label: '支付成功·出小票' },
  { code: 'PREPARING', label: '制作中' },
  { code: 'COMPLETED', label: '完成取餐' },
]

type OrderDetailLine = OrderItem & { priceText: string; subtotalText: string; specText: string }
type OrderDetailView = Order & {
  totalText: string
  receiptDate: string
  statusText: string
  lines: OrderDetailLine[]
  queueNo?: number
  storeName?: string
  statusCode: string
  timeline: Array<{ label: string; done: boolean }>
  isPaidOrMaking: boolean
  canPayNow: boolean
  canRefund: boolean
}

const normalizeStatus = (status: string) => status

const buildTimeline = (statusCode: string) => {
  const flow = ['PENDING_PAY', 'PAID', 'PREPARING', 'COMPLETED']
  /* 取消/退款态：只走第一步 */
  if (['cancelled', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING'].indexOf(statusCode) >= 0) {
    return TIMELINE_STEPS.map((step, index) => ({ ...step, done: index === 0 }))
  }
  const currentIndex = flow.indexOf(statusCode)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  return TIMELINE_STEPS.map((step, index) => ({ ...step, done: index <= safeIndex }))
}

const getOrderView = (orderId: string): OrderDetailView | null => {
  const order = getOrderById(orderId)
  if (!order) {
    return null
  }

  const raw = order as unknown as {
    status?: string
    queueNo?: number
    storeName?: string
    items: OrderItem[]
  }
  const statusCode = normalizeStatus(raw.status || 'submitted')
  const items = (raw.items || []) as OrderItem[]
  const specLines: OrderDetailLine[] = items.map((item) => {
    const withSpecs = item as OrderItem & { selections?: Array<{ optionName?: string }> }
    const specText =
      withSpecs.selections && withSpecs.selections.length
        ? withSpecs.selections.map((ref) => ref.optionName).join('/')
        : ''
    return {
      ...item,
      priceText: formatMoney(item.price),
      subtotalText: formatMoney(item.subtotal),
      specText,
    }
  })

  return {
    ...(order as Order),
    totalText: formatMoney(order.total),
    receiptDate: formatReceiptDate(order.createdAt),
    statusText: STATUS_META[statusCode] || '已提交',
    statusCode,
    queueNo: raw.queueNo,
    storeName: raw.storeName || '',
    timeline: buildTimeline(statusCode),
    isPaidOrMaking: statusCode === 'PAID' || statusCode === 'PREPARING',
    canPayNow: statusCode === 'PENDING_PAY',
    canRefund: statusCode === 'PAID' || statusCode === 'PREPARING',
    lines: specLines,
  }
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    order: null as OrderDetailView | null,
    ratingOptions: [1, 2, 3, 4, 5],
    rating: 5,
    comment: '',
    paying: false,
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
        wx.navigateBack({ delta: 1 })
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

  /* 待支付 → 直接唤起模拟支付 */
  async payNow() {
    const order = this.data.order
    if (!order || this.data.paying) {
      return
    }
    if (!initCloud()) {
      wx.showToast({ title: '云端不可用', icon: 'none' })
      return
    }
    this.setData({ paying: true })
    try {
      const paid = await payOrderCloud(order.id)
      cacheOrder(paid as unknown as Order)
      this.setData({ paying: false })
      this.loadOrder(order.id)
      wx.showToast({ title: '支付成功', icon: 'success' })
    } catch (error) {
      console.error('[order-detail] pay failed', error)
      this.setData({ paying: false })
      wx.showToast({ title: '支付失败，请重试', icon: 'none' })
    }
  },

  /* 申请退款（进入退款审核，管理员在管理端处理） */
  applyRefund() {
    const order = this.data.order
    if (!order) {
      return
    }
    wx.showModal({
      title: '申请退款',
      content: `将为该笔订单提交退款申请（${formatMoney(order.total)}），确认继续？`,
      confirmText: '申请退款',
      success: async (res) => {
        if (!res.confirm || !initCloud()) {
          return
        }
        try {
          await refundApplyCloud(order.id, '用户主动申请')
          this.loadOrder(order.id)
          wx.showToast({ title: '已提交退款申请', icon: 'success' })
        } catch (error) {
          console.error('[order-detail] refundApply failed', error)
          wx.showToast({ title: '提交失败，请重试', icon: 'none' })
        }
      },
    })
  },

  submitReview() {
    const order = this.data.order as { id: string; status: string } | null
    if (!order) {
      return
    }

    if (order.status !== 'completed' && order.status !== 'COMPLETED') {
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
