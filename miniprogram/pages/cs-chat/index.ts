import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { csCreateSessionCloud, csGetMessagesCloud, csListMySessionsCloud, csSendMessageCloud } from '../../utils/cloud'
import { initCloud } from '../../utils/cloud'

const nn = <T>(value: T | null | undefined, fallback: T): T => (value === null || value === undefined ? fallback : value)

const KB_HINT = '您好，我是 Orander 智能客服～门店营业时间 10:00-22:00，排队号可在订单详情查看。还有什么可以帮您？'

interface RawCsMessage {
  role?: string
  content?: string
  at?: string
  type?: string
  imageFileId?: string
}

interface ChatRow {
  id: string
  mine: boolean
  isImage: boolean
  text: string
  image: string
  timeText: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    sessionId: '',
    messages: [] as ChatRow[],
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

  mapRows(raws: RawCsMessage[]): ChatRow[] {
    const rows = raws.map((raw, index) => ({
      id: `msg-${index}-${raw.at || ''}`,
      mine: raw.role === 'user',
      isImage: raw.type === 'image' && !!raw.imageFileId,
      text: raw.content || '',
      image: raw.imageFileId || '',
      timeText: (raw.at || '').slice(11, 16),
    }))
    if (!rows.some((row) => !row.mine)) {
      rows.unshift({ id: 'welcome', mine: false, isImage: false, text: KB_HINT, image: '', timeText: '' })
    }
    return rows
  },

  async refreshMessages() {
    if (!this.data.sessionId) return
    try {
      const data = nn(await csGetMessagesCloud(this.data.sessionId), { messages: [] })
      const rows = this.mapRows((data.messages || []) as unknown as RawCsMessage[])
      this.setData({
        messages: rows,
        scrollInto: rows.length ? `chat-${rows.length - 1}` : '',
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
      await csSendMessageCloud({ sessionId: this.data.sessionId, text, type: 'text' })
      await this.refreshMessages()
    } catch (error) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  /* 图片消息：选图 → 云存储 → sendMessage type=image */
  async sendImage() {
    if (this.data.sending || !this.data.sessionId) return
    if (!initCloud()) {
      wx.showToast({ title: '云环境不可用', icon: 'none' })
      return
    }
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })
      const file = res.tempFiles && res.tempFiles[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        wx.showToast({ title: '图片需 ≤2MB', icon: 'none' })
        return
      }
      this.setData({ sending: true })
      const ext = (file.tempFilePath.split('.').pop() || 'png').toLowerCase()
      const up = await wx.cloud.uploadFile({ cloudPath: `orander/cs/${Date.now()}.${ext}`, filePath: file.tempFilePath })
      await csSendMessageCloud({ sessionId: this.data.sessionId, type: 'image', imageFileId: up.fileID })
      await this.refreshMessages()
    } catch (error) {
      wx.showToast({ title: '图片发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  holdVoice() {
    wx.showToast({ title: '语音输入即将开放', icon: 'none' })
  },

  async previewImage(event: WechatMiniprogram.BaseEvent) {
    const fileID = event.currentTarget.dataset.src as string
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [fileID] })
      const url = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL
      if (url) {
        wx.previewImage({ urls: [url] })
      }
    } catch (_error) {
      wx.showToast({ title: '图片加载失败', icon: 'none' })
    }
  },
})
