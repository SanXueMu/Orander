import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { csCreateSessionCloud, csGetMessagesCloud, csListMySessionsCloud, csSendMessageCloud, type CsMessage } from '../../utils/cloud'

const nn = <T>(value: T | null | undefined, fallback: T): T => (value === null || value === undefined ? fallback : value)

const KB_HINT = '您好，我是 Orander 智能客服～门店营业时间 10:00-22:00，排队号可在订单详情查看。还有什么可以帮您？'

Page({
  behaviors: [pageLookBehavior],

  data: {
    sessionId: '',
    messages: [] as Array<CsMessage & { mine: boolean; timeText?: string }>,
    input: '',
    sending: false,
    scrollInto: '',
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    void this.ensureSession()
  },

  async ensureSession() {
    try {
      const list = (await csListMySessionsCloud().catch(() => ({ items: [] }))) || { items: [] }
      const open = (list.items || [])[0]
      const sessionId = open ? open.id : nn(await csCreateSessionCloud(), { id: '' }).id
      this.setData({ sessionId })
      await this.refreshMessages()
    } catch (error) {
      wx.showToast({ title: '客服暂不可用', icon: 'none' })
    }
  },

  async refreshMessages() {
    if (!this.data.sessionId) return
    try {
      const data = nn(await csGetMessagesCloud(this.data.sessionId), { messages: [] })
      let messages = (data.messages || []).map((message) => ({ ...message, mine: message.from === 'USER' }))
      /* 本地无回复时用知识库话术兜底展示 */
      if (!messages.some((m) => !m.mine)) {
        messages = messages.concat([{ id: 'welcome', from: 'SYSTEM', type: 'text', text: KB_HINT, createdAt: '', mine: false }])
      }
      this.setData({
        messages,
        scrollInto: messages.length ? `msg-${messages.length - 1}` : '',
      })
    } catch (error) {
      /* 静默 */
    }
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ input: event.detail.value })
  },

  async send() {
    const text = this.data.input.trim()
    if (!text || this.data.sending || !this.data.sessionId) return
    this.setData({ input: '', sending: true })
    try {
      await csSendMessageCloud({ sessionId: this.data.sessionId, text })
      await this.refreshMessages()
    } catch (error) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },
})
