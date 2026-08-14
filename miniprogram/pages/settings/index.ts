import {
  DEFAULT_AVATAR_URL,
  FONT_OPTIONS,
  RELATION_OPTIONS,
  THEME_OPTIONS,
  getAvatarStyle,
  getCurrentMember,
  getMonogram,
  saveCurrentMember,
} from '../../utils/orander'
import type { FontId, Member, ThemeId } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

const getRelationIndex = (relation: string) => {
  const index = RELATION_OPTIONS.findIndex((item) => item === relation)
  return index >= 0 ? index : 0
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    profile: null as Member | null,
    avatarLabel: 'OR',
    avatarStyle: getAvatarStyle('guest'),
    relationOptions: RELATION_OPTIONS,
    themeOptions: THEME_OPTIONS,
    fontOptions: FONT_OPTIONS,
    relationIndex: 0,
    nickname: '',
    customRelation: '',
    avatarUrl: DEFAULT_AVATAR_URL,
    selectedThemeId: 'amber' as ThemeId,
    selectedFontId: 'modern' as FontId,
  },

  onShow() {
    const profile = getCurrentMember()
    applyPageLook(this, profile)

    this.setData({
      profile,
      avatarLabel: getMonogram(profile ? profile.nickname : 'OR'),
      avatarStyle: getAvatarStyle(profile ? profile.nickname : 'guest'),
      relationIndex: profile ? getRelationIndex(profile.relation) : 0,
      nickname: profile ? profile.nickname : '',
      customRelation: profile ? profile.customRelation : '',
      avatarUrl: profile ? profile.avatarUrl : DEFAULT_AVATAR_URL,
      selectedThemeId: profile ? profile.themeId : 'amber',
      selectedFontId: profile ? profile.fontId : 'modern',
    })
  },

  onChooseAvatar(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { avatarUrl?: string }
    if (!detail.avatarUrl) {
      return
    }

    this.setData({
      avatarUrl: detail.avatarUrl,
    })
  },

  onNicknameInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    const nickname = detail.value || ''
    this.setData({
      nickname,
      avatarLabel: getMonogram(nickname || 'OR'),
      avatarStyle: getAvatarStyle(nickname || 'guest'),
    })
  },

  onRelationChange(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({
      relationIndex: Number(detail.value || 0),
    })
  },

  onCustomRelationInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({
      customRelation: detail.value || '',
    })
  },

  pickTheme(event: WechatMiniprogram.BaseEvent) {
    const themeId = event.currentTarget.dataset.id as string
    this.setData({
      selectedThemeId: themeId as ThemeId,
      themeClass: `theme-${themeId}`,
    })
  },

  pickFont(event: WechatMiniprogram.BaseEvent) {
    const fontId = event.currentTarget.dataset.id as string
    this.setData({
      selectedFontId: fontId as FontId,
      fontClass: `font-${fontId}`,
    })
  },

  saveProfile() {
    const nickname = this.data.nickname.trim()
    const relation = RELATION_OPTIONS[this.data.relationIndex]
    const customRelation = this.data.customRelation.trim()

    if (!nickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none',
      })
      return
    }

    if (relation === '自定义' && !customRelation) {
      wx.showToast({
        title: '请补充自定义关系',
        icon: 'none',
      })
      return
    }

    saveCurrentMember({
      nickname,
      avatarUrl: this.data.avatarUrl,
      relation,
      customRelation,
      themeId: this.data.selectedThemeId as ThemeId,
      fontId: this.data.selectedFontId as FontId,
    })

    this.onShow()
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
    })
  },
})
