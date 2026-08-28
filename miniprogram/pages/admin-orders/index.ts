import { getAdminToken } from '../../utils/orander'
import {
  adminListOrdersCloud, adminListRefundsCloud, adminReviewRefundCloud,
  adminStartPreparingCloud, adminCompleteOrderCloud, type XiOrder,
} from '../../utils/cloud'

const TABS = [
  { key: 'all', name: '全部' },
  { key: 'PENDING_PAY', name: '待支付' },
  { key: 'PAID', name: '已支付' },
  { key: 'PREPARING', name: '制作中' },
  { key: 'refund', name: '退款' },
]

const STATUS_TEXT: Record<string, string> = {
  PENDING_PAY: '待支付', PAID: '已支付', PREPARING: '制作中', COMPLETED: '已完成',
  CANCELLED: '已取消', REFUNDED: '已退款', REFUND_PENDING: '退款审核中',
}

type OrderRow = XiOrder & { statusCode: string; statusText: string; previewText: string; bizText: string; timeText: string; totalText: string }

Page({
  data: {
    tabs: TABS,
    activeTab: 'all',
    orders: [] as OrderRow[],
    refunds: [] as Array<{ id: string; orderId: string; orderNumber: string; reason: string; amountText: string; status: string; statusText: string }>,
    loading: false,
    page: 1,
    hasMore: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const tab = query.tab && TABS.some((item) => item.key === query.tab) ? query.tab : 'all'
    this.setData({ activeTab: tab })
  },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    this.reload()
  },

  switchTab(event: WechatMiniprogram.Touch) {
    this.setData({ activeTab: event.currentTarget.dataset.key as string })
    this.reload()
  },

  async reload() {
    this.setData({ loading: true, page: 1, hasMore: false })
    if (this.data.activeTab === 'refund') {
      await this.loadRefunds()
    } else {
      await this.loadOrders()
    }
    this.setData({ loading: false })
  },

  async loadOrders() {
    const token = getAdminToken()
    if (!token) { return }
    const data = await adminListOrdersCloud(token, this.data.page)
    if (!data) { return }
    const orders = data.items.map((raw) => this.mapRow(raw))
    const filtered = this.data.activeTab === 'all' ? orders : orders.filter((order) => order.statusCode === this.data.activeTab)
    this.setData({
      orders: this.data.page === 1 ? filtered : this.data.orders.concat(filtered),
      hasMore: this.data.page * 20 < (data.total || 0),
    })
  },

  async loadRefunds() {
    const token = getAdminToken()
    if (!token) { return }
    const data = await adminListRefundsCloud(token)
    if (!data) { return }
    this.setData({
      refunds: data.items.map((raw) => ({
        id: String(raw.id || ''),
        orderId: String(raw.orderId || ''),
        orderNumber: String(raw.orderNumber || raw.orderId || ''),
        reason: String(raw.reason || '未填写'),
        amountText: `¥${Number(raw.amount || 0).toFixed(2)}`,
        status: String(raw.status || 'PENDING'),
        statusText: String(raw.status) === 'PENDING' ? '待审核' : String(raw.status) === 'REFUNDED' ? '已退款' : '已驳回',
      })),
    })
  },

  mapRow(raw: XiOrder): OrderRow {
    const statusCode = String(raw.status || 'PENDING_PAY')
    const items = raw.items || []
    return {
      ...raw,
      statusCode,
      statusText: STATUS_TEXT[statusCode] || statusCode,
      previewText: items.map((line) => `${line.name} x${line.quantity}`).join('、') || '百货订单',
      bizText: String(raw.biz || 'TEA') === 'MALL' ? '百货' : '茶饮',
      timeText: new Date(raw.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      totalText: `¥${Number(raw.payAmount != null ? raw.payAmount : raw.total || 0).toFixed(2)}`,
    }
  },

  async loadMore() {
    this.setData({ page: this.data.page + 1 })
    await this.loadOrders()
  },

  async act(token: string, id: string, fn: (t: string, i: string) => Promise<unknown>, okText: string) {
    wx.showLoading({ title: '处理中' })
    await fn(token, id)
    wx.hideLoading()
    wx.showToast({ title: okText, icon: 'success' })
    this.reload()
  },

  startMaking(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (token) { void this.act(token, event.currentTarget.dataset.id as string, adminStartPreparingCloud, '已开始制作') }
  },

  complete(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (token) { void this.act(token, event.currentTarget.dataset.id as string, adminCompleteOrderCloud, '已完成') }
  },

  async approveRefund(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (!token) { return }
    await this.act(token, event.currentTarget.dataset.id as string, (t, i) => adminReviewRefundCloud(t, i, true), '已退款')
  },

  async rejectRefund(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (!token) { return }
    await this.act(token, event.currentTarget.dataset.id as string, (t, i) => adminReviewRefundCloud(t, i, false), '已驳回')
  },

  goDetail(event: WechatMiniprogram.Touch) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${event.currentTarget.dataset.id}` })
  },
})
