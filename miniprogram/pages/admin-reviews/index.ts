import { getAdminToken } from '../../utils/orander'
import { adminListReviewsCloud, adminModerateReviewCloud, adminReplyReviewCloud } from '../../utils/cloud'

type ReviewRow = Record<string, unknown> & {
  id: string; rating?: number; content?: string; status?: string; reply?: string; createdAt?: string; nickname?: string
}

Page({
  data: {
    loading: true,
    reviews: [] as ReviewRow[],
    replyingId: '',
    replyText: '',
  },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    void this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    const token = getAdminToken()
    if (!token) return
    const data = await adminListReviewsCloud(token).catch(() => null)
    this.setData({ reviews: ((data && data.items) || []) as ReviewRow[], loading: false })
  },

  async moderate(event: WechatMiniprogram.TouchEvent) {
    const token = getAdminToken()
    const id = String(event.currentTarget.dataset.id)
    const status = String(event.currentTarget.dataset.status) as 'APPROVED' | 'REJECTED'
    if (!token || !id) return
    await adminModerateReviewCloud(token, id, status)
    wx.showToast({ title: status === 'APPROVED' ? '已通过' : '已驳回', icon: 'none' })
    void this.refresh()
  },

  startReply(event: WechatMiniprogram.TouchEvent) {
    this.setData({ replyingId: String(event.currentTarget.dataset.id), replyText: '' })
  },

  onReply(event: WechatMiniprogram.Input) {
    this.setData({ replyText: event.detail.value })
  },

  async submitReply() {
    const token = getAdminToken()
    const id = this.data.replyingId
    if (!token || !id || !this.data.replyText.trim()) {
      wx.showToast({ title: '填写回复内容', icon: 'none' })
      return
    }
    await adminReplyReviewCloud(token, id, this.data.replyText.trim())
    wx.showToast({ title: '已回复', icon: 'success' })
    this.setData({ replyingId: '', replyText: '' })
    void this.refresh()
  },

  statusLabel(value?: string) {
    const label: Record<string, string> = { PENDING: '待审', APPROVED: '已通过', REJECTED: '已驳回' }
    return label[String(value || 'PENDING')] || '待审'
  },
})
