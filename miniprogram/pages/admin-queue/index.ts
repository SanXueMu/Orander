import { getAdminToken } from '../../utils/orander'
import { adminListOrdersCloud, adminStartPreparingCloud, adminCompleteOrderCloud, type XiOrder } from '../../utils/cloud'

type QueueRow = XiOrder & { previewText: string; totalText: string }

const mapRow = (raw: XiOrder): QueueRow => ({
  ...raw,
  previewText: (raw.items || []).map((line) => `${line.name} x${line.quantity}`).join('、') || '百货订单',
  totalText: `¥${Number(raw.payAmount != null ? raw.payAmount : raw.total || 0).toFixed(2)}`,
})

Page({
  data: { pending: [] as QueueRow[], making: [] as QueueRow[], done: [] as QueueRow[], doneCount: 0 },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    this.refresh()
  },

  async refresh() {
    const token = getAdminToken()
    if (!token) { return }
    const data = await adminListOrdersCloud(token, 1, 100)
    if (!data) { return }
    const rows = data.items.map(mapRow)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const done = rows.filter((row) => row.status === 'COMPLETED' && new Date(row.createdAt) >= startOfDay)
    this.setData({
      pending: rows.filter((row) => row.status === 'PAID'),
      making: rows.filter((row) => row.status === 'PREPARING'),
      done,
      doneCount: done.length,
    })
  },

  async startMaking(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (!token) { return }
    wx.showLoading({ title: '处理中' })
    await adminStartPreparingCloud(token, event.currentTarget.dataset.id as string)
    wx.hideLoading()
    this.refresh()
  },

  async complete(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    if (!token) { return }
    wx.showLoading({ title: '处理中' })
    await adminCompleteOrderCloud(token, event.currentTarget.dataset.id as string)
    wx.hideLoading()
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },
})
