import {
  formatMoney,
  formatShortDate,
  cacheOrder,
  getCurrentMember,
  getOrdersForCurrentMember,
  isVisitorSession,
} from '../../utils/orander'
import type { Member } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getMyOrdersV2Cloud, initCloud, type XiOrder } from '../../utils/cloud'

/* 新旧状态统一映射：云端新状态机(大写) + 本地旧状态(小写) */
const STATUS_META: Record<string, { text: string; tone: string }> = {
  /* 旧版 */
  submitted: { text: '已提交', tone: 'appetite' },
  preparing: { text: '制作中', tone: 'appetite' },
  completed: { text: '已完成', tone: 'success' },
  cancelled: { text: '已取消', tone: 'muted' },
  /* 喜茶复刻 R1 状态机 */
  PENDING_PAY: { text: '待支付', tone: 'appetite' },
  PAID: { text: '已下单·排队中', tone: 'brand' },
  PREPARING: { text: '制作中', tone: 'appetite' },
  COMPLETED: { text: '已完成', tone: 'success' },
  REFUND_PENDING: { text: '退款审核中', tone: 'muted' },
  REFUNDED: { text: '已退款', tone: 'muted' },
}

type OrderCardView = ReturnType<typeof mapOne>[number]

const mapOne = (orders: Array<Record<string, unknown>>) => {
  return orders.map((raw) => {
    const order = raw as unknown as XiOrder & { statusText?: string }
    const meta = STATUS_META[order.status] || STATUS_META.submitted
    const created = new Date(order.createdAt)
    const items = (order.items || []) as Array<{ name: string }>
    const biz = order.biz || 'TEA'
    return {
      ...order,
      biz,
      totalText: formatMoney(order.total),
      createdText: formatShortDate(order.createdAt),
      dayKey: `${created.getFullYear()}-${created.getMonth() + 1}-${created.getDate()}`,
      statusText: meta.text,
      statusTone: meta.tone,
      queueText: typeof order.queueNo !== 'undefined' && (order.status === 'PAID' || order.status === 'PREPARING') ? `${order.queueNo} 号` : '',
      previewText: items.slice(0, 3).map((item) => item.name).join(' · '),
      isDone: order.status === 'COMPLETED' || order.status === 'completed',
    }
  })
}

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
    activeBiz: 'TEA' as 'TEA' | 'MALL',
    allOrders: [] as OrderCardView[],
    orderGroups: [] as OrderGroup[],
    hasOrders: false,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.showModal({
        title: '登录后查看',
        content: '订单历史属于个人信息，登录后即可查看。',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile-edit/index' })
          }
        },
      })
    }

    applyPageLook(this, getCurrentMember())

    /* 本地缓存（含刚下单的）优先渲染，再拉云端 v2 订单合并 */
    const localOrders = mapOne(getOrdersForCurrentMember() as unknown as Array<Record<string, unknown>>)
    this.render(localOrders)

    if (initCloud()) {
      getMyOrdersV2Cloud().then((page) => {
        if (page && page.items && page.items.length) {
          page.items.forEach((order) => cacheOrder(order as unknown as Parameters<typeof cacheOrder>[0]))
          this.render(mapOne(getOrdersForCurrentMember() as unknown as Array<Record<string, unknown>>))
        }
      })
    }
  },

  render(orders: OrderCardView[]) {
    const filtered = orders.filter((order) => (order.biz || 'TEA') === this.data.activeBiz)
    this.setData({
      allOrders: orders,
      orderGroups: groupOrdersByDay(filtered),
      hasOrders: filtered.length > 0,
    })
  },

  switchBiz(event: WechatMiniprogram.BaseEvent) {
    const biz = event.currentTarget.dataset.biz as 'TEA' | 'MALL'
    if (biz === this.data.activeBiz) {
      return
    }
    this.setData({ activeBiz: biz }, () => this.render(this.data.allOrders))
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
