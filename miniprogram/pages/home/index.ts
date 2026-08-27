import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getHomeActivitiesCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    activities: [] as import('../../utils/cloud').HomeActivity[],
    profile: null as ReturnType<typeof getCurrentMember>,
    greetingText: '',
    dateText: '',
  },

  onShow() {
    this.loadActivities()
    const profile = isVisitorSession() ? null : getCurrentMember()
    applyPageLook(this, profile)

    const now = new Date()
    const hour = now.getHours()
    let greeting = '你好'
    if (hour < 6) {
      greeting = '夜深了'
    } else if (hour < 11) {
      greeting = '早上好'
    } else if (hour < 14) {
      greeting = '中午好'
    } else if (hour < 18) {
      greeting = '下午好'
    } else {
      greeting = '晚上好'
    }

    this.setData({
      profile,
      greetingText: profile ? `${greeting}，${profile.nickname}` : `${greeting}，欢迎光临`,
      dateText: `${now.getMonth() + 1}月${now.getDate()}日 · 灵感之茶`,
    })
    void this.loadActivities()
  },

  goPickup() {
    wx.redirectTo({
      url: '/pages/dish/index',
    })
  },

  goDelivery() {
    wx.redirectTo({
      url: '/pages/dish/index',
    })
  },

  async loadActivities() {
    try {
      const data = await getHomeActivitiesCloud()
      this.setData({ activities: (data && data.activities) || [] })
    } catch (error) {
      this.setData({ activities: [] })
    }
  },

  comingSoonInvite() {
    wx.showToast({ title: '邀请有礼即将上线', icon: 'none' })
  },
})
