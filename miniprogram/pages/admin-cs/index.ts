import { getAdminToken } from '../../utils/orander'
import { adminListSessionsCloud, adminReplyCsCloud } from '../../utils/cloud'

type SessionRow = Record<string, unknown> & {
  id: string; status?: string; nickname?: string; messages?: Array<{ from?: string; text?: string; createdAt?: string }>
}

Page({
  data: {
    loading: true,
    sessions: [] as SessionRow[],
    openId: '',
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
    const data = await adminListSessionsCloud(token).catch(() => null)
    this.setData({ sessions: ((data && data.items) || []) as SessionRow[], loading: false })
  },

  toggle(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id)
    this.setData({ openId: this.data.openId === id ? '' : id })
  },

  onReply(event: WechatMiniprogram.Input) {
    this.setData({ replyText: event.detail.value })
  },

  async sendReply() {
    const token = getAdminToken()
    const id = this.data.openId
    if (!token || !id || !this.data.replyText.trim()) {
      wx.showToast({ title: '输入回复内容', icon: 'none' })
      return
    }
    await adminReplyCsCloud(token, id, this.data.replyText.trim())
    wx.showToast({ title: '已发送', icon: 'success' })
    this.setData({ replyText: '' })
    void this.refresh()
  },

  lastText(session: SessionRow) {
    const messages = session.messages || []
    return messages.length ? String(messages[messages.length - 1].text || '') : '（无消息）'
  },
})
