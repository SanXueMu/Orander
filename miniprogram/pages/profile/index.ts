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
import type { ThemeId } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

/* 成员主题色点：与三主题光斑同源 */
const THEME_DOT: Record<ThemeId, string> = {
  amber: '#f0c9a0',
  olive: '#bcd4ae',
  ink: '#8a5632',
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '访客',
    avatarUrl: '',
    showAvatarImage: false,
    avatarLabel: 'OR',
    avatarStyle: getAvatarStyle('profile'),
    themeDotStyle: `background:${THEME_DOT.amber};`,
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
    applyPageLook(this, member)
    const nickname = member ? member.nickname : session ? session.nickname : '访客'
    const avatarUrl = member ? member.avatarUrl : session ? session.avatarUrl : ''
    const showAvatarImage = !!avatarUrl

    this.setData({
      nickname,
      avatarUrl,
      showAvatarImage,
      avatarLabel: getMonogram(nickname, 'ME'),
      avatarStyle: getAvatarStyle(nickname),
      themeDotStyle: `background:${THEME_DOT[member ? member.themeId : 'amber']};`,
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

  onNicknameFocus() {
    this.setData({ nicknameFocused: true })
  },

  onNicknameBlur() {
    this.setData({ nicknameFocused: false })
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

    this.refreshIdentity(nextMember)
    wx.showToast({
      title: '已保存',
      icon: 'success',
    })
  },

  refreshIdentity(member: NonNullable<ReturnType<typeof getCurrentMember>>) {
    applyPageLook(this, member)
    this.setData({
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      showAvatarImage: !!member.avatarUrl,
      avatarLabel: getMonogram(member.nickname, 'ME'),
      avatarStyle: getAvatarStyle(member.nickname),
      themeDotStyle: `background:${THEME_DOT[member.themeId]};`,
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
