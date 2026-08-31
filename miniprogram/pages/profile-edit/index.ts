import { getCurrentMember, getSession, isVisitorSession, updateCurrentMember } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { initCloud, syncVisitorMemberCloud } from '../../utils/cloud'

const NICKNAME_MAX = 16

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '',
    avatarUrl: '',
    dirty: false,
    busy: false,
    loggedIn: true,
  },

  onLoad() {
    const session = getSession()
    const member = getCurrentMember()
    this.setData({
      loggedIn: !!member || !!session,
      nickname: (member && member.nickname) || (session && session.nickname) || '',
      avatarUrl: (member && member.avatarUrl) || (session && session.avatarUrl) || '',
    })
    applyPageLook(this, getCurrentMember())
  },

  onNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({ nickname: (event.detail.value || '').slice(0, NICKNAME_MAX), dirty: true })
  },

  onChooseAvatar(event: WechatMiniprogram.CustomEvent) {
    const avatarUrl = String((event.detail as { avatarUrl?: string }).avatarUrl || '')
    if (!avatarUrl) return
    this.setData({ avatarUrl, dirty: true })
  },

  async save() {
    if (this.data.busy) return
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    updateCurrentMember({ nickname, avatarUrl: this.data.avatarUrl })
    try {
      if (initCloud() && isVisitorSession()) {
        await syncVisitorMemberCloud({ nickname, avatarUrl: this.data.avatarUrl, loginCode: '' })
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (error) {
      wx.showToast({ title: '本地已保存，云端同步暂不可用', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 900)
    } finally {
      this.setData({ busy: false })
    }
  },
})
