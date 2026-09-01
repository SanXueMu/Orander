import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'

Page({
  behaviors: [pageLookBehavior],

  data: {
    navColor: '',
    navBackground: '',
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    this.setData({ navColor: '#1a1a1a', navBackground: '#ffffff' })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  goPolicies() {
    wx.navigateTo({ url: '/pages/policies/index' })
  },
})
