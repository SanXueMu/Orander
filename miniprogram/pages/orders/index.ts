import {
  formatMoney,
  formatShortDate,
  getCurrentMember,
  getOrdersForCurrentMember,
  isVisitorSession,
} from '../../utils/orander'
import type { Member, OrderStatus } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

const STATUS_META: Record<OrderStatus, { text: string; tone: string }> = {
  submitted: { text: '已提交', tone: 'appetite' },
  preparing: { text: '制作中', tone: 'appetite' },
  completed: { text: '已完成', tone: 'success' },
  cancelled: { text: '已取消', tone: 'muted' },
}

type OrderCardView = ReturnType<typeof mapOrders>[number]

const mapOrders = () => {
  return getOrdersForCurrentMember().map((order) => {
    const meta = STATUS_META[order.status] || STATUS_META.submitted
    const created = new Date(order.createdAt)
    return {
      ...order,
      totalText: formatMoney(order.total),
      createdText: formatShortDate(order.createdAt),
      dayKey: `${created.getFullYear()}-${created.getMonth() + 1}-${created.getDate()}`,
      statusText: meta.text,
      statusTone: meta.tone,
      previewText: order.items.slice(0, 3).map((item) => item.name).join(' · '),
      reviewText: order.review ? `${order.review.rating} 星评价` : order.status === 'completed' ? '待评价' : '待完成后评价',
    }
  })
}

/* 日期分组：今天/昨天/MM月DD日 */
interface OrderGroup {
  label: string
  orders: OrderCardView[]
}

const groupOrdersByDay = (orders: OrderCardView[]): OrderGroup[] => {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const groups: OrderGroup[] = []
  const groupMap = new Map<string, OrderGroup>()

  orders.forEach((order) => {
    let group = groupMap.get(order.dayKey)
    if (!group) {
      const created = new Date(order.createdAt)
      const day = new Date(created.getFullYear(), created.getMonth(), created.getDate())
      const diff = Math.round((today.getTime() - day.getTime()) / dayMs)
      const label = diff === 0 ? '今天' : diff === 1 ? '昨天' : `${created.getMonth() + 1}月${created.getDate()}日`
      group = { label, orders: [] }
      groupMap.set(order.dayKey, group)
      groups.push(group)
    }
    group.orders.push(order)
  })

  return groups
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    profile: null as Member | null,
    orderGroups: [] as OrderGroup[],
    hasOrders: false,
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

    const orders = mapOrders()
    this.setData({
      profile,
      orderGroups: groupOrdersByDay(orders),
      hasOrders: orders.length > 0,
    })
  },

  openOrder(event: WechatMiniprogram.BaseEvent) {
    const orderId = event.currentTarget.dataset.id as string
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${orderId}`,
    })
  },

  goMenu() {
    wx.redirectTo({
      url: '/pages/dish/index',
    })
  },
})
