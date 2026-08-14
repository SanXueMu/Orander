import { initCloud, syncVisitorMemberCloud } from '../../utils/cloud'
import {
  clearCart,
  clearSession,
  getAvatarStyle,
  getCurrentMember,
  getMonogram,
  getSession,
  isVisitorSession,
  saveCurrentMember,
  saveSession,
} from '../../utils/orander'

Page({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#111111',
    navBackground: '#f4f4f4',
    nickname: '访客',
    avatarUrl: '',
    showAvatarImage: false,
    avatarLabel: 'OR',
    avatarStyle: getAvatarStyle('profile'),
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    const member = getCurrentMember()
    const session = getSession()
    const nickname = member ? member.nickname : session ? session.nickname : '访客'
    const avatarUrl = member ? member.avatarUrl : session ? session.avatarUrl : ''
    const showAvatarImage = !!avatarUrl

    this.setData({
      nickname,
      avatarUrl,
      showAvatarImage,
      avatarLabel: getMonogram(nickname, 'ME'),
      avatarStyle: getAvatarStyle(nickname),
    })
  },

  onChooseAvatar(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { avatarUrl?: string }
    const avatarUrl = detail.avatarUrl || ''
    this.setData({
      avatarUrl,
      showAvatarImage: !!avatarUrl,
    })
  },

  onNicknameInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    const nickname = (detail.value || '').trim()

    this.setData({
      nickname,
      avatarLabel: getMonogram(nickname || 'ME', 'ME'),
      avatarStyle: getAvatarStyle(nickname || 'profile'),
    })
  },

  async saveProfile() {
    const member = getCurrentMember()
    const session = getSession()
    const nickname = this.data.nickname.trim() || '访客'
    const avatarUrl = this.data.avatarUrl

    if (!member || !session) {
      return
    }

    const nextMember = saveCurrentMember({
      nickname,
      avatarUrl,
      relation: member.relation,
      customRelation: member.customRelation,
      themeId: member.themeId,
      fontId: member.fontId,
    })

    saveSession({
      ...session,
      nickname: nextMember.nickname,
      avatarUrl: nextMember.avatarUrl,
      memberId: nextMember.id,
    })

    if (initCloud()) {
      await syncVisitorMemberCloud({
        nickname: nextMember.nickname,
        avatarUrl: nextMember.avatarUrl,
        loginCode: session.loginCode,
      })
    }

    this.onShow()
    wx.showToast({
      title: '已保存',
      icon: 'success',
    })
  },

  logout() {
    clearCart()
    clearSession(false)
    wx.reLaunch({
      url: '/pages/index/index',
    })
  },

  goSettings() {
    wx.navigateTo({
      url: '/pages/settings/index',
    })
  },
})
