import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getHomeActivitiesCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    activities: [] as import('../../utils/cloud').HomeActivity[],
    posters: [] as Array<{ key: string; title: string; subtitle?: string; kicker?: string; ctaText?: string; badge?: string; heroImage?: string; tone: number }>,
    posterCur: 0,
    posterProgress: 100,
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

  onPosterChange(event: WechatMiniprogram.SwiperChange) {
    const total = this.data.posters.length || 1
    this.setData({
      posterCur: event.detail.current,
      posterProgress: Math.round(((event.detail.current + 1) / total) * 100),
    })
  },

  async loadActivities() {
    try {
      const data = await getHomeActivitiesCloud()
      const activities = (data && data.activities) || []
      const KICKER: Record<string, string> = { NEW_PRODUCT: '新品首发', ANNIVERSARY: '周年庆', INVITE_MEMBER: '邀请有礼', SELLING_POINT: '单品卖点' }
      const CTA: Record<string, string> = { NEW_PRODUCT: '去尝鲜', ANNIVERSARY: '立即下单', SELLING_POINT: '去点单' }
      const TONE: Record<string, number> = { NEW_PRODUCT: 0, ANNIVERSARY: 1, INVITE_MEMBER: 2, SELLING_POINT: 3 }
      const posters = activities.map((item) => ({
        key: item.id,
        title: item.title || '',
        subtitle: item.subtitle || '',
        kicker: KICKER[String(item.template)] || '',
        ctaText: CTA[String(item.template)] || '',
        badge: String(item.template) === 'NEW_PRODUCT' ? 'NEW' : '',
        heroImage: ((item as unknown as Record<string, unknown>).heroImage as string) || '',
        tone: TONE[String(item.template)] ?? 4,
      }))
      if (!posters.length) {
        posters.push({ key: 'empty', title: '一杯灵感之茶', subtitle: '此刻为你现制', kicker: 'ORANDER GO', ctaText: '去点单', badge: '', heroImage: '', tone: 0 })
      }
      this.setData({ activities, posters, posterCur: 0, posterProgress: Math.round((1 / posters.length) * 100) })
    } catch (error) {
      this.setData({ activities: [], posters: [{ key: 'empty', title: '一杯灵感之茶', subtitle: '此刻为你现制', kicker: 'ORANDER GO', ctaText: '去点单', badge: '', heroImage: '', tone: 0 }] })
    }
  },

  comingSoonInvite() {
    wx.showToast({ title: '邀请有礼即将上线', icon: 'none' })
  },
})
