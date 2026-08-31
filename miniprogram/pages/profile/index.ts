import {
  clearCart,
  clearSession,
  formatMoney,
  getCurrentMember,
  getSession,
  isVisitorSession,
} from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getMemberProfileCloud, listAssetsCloud, notifyListCloud, type LevelCard } from '../../utils/cloud'

const getMonogram = (value: string, fallback: string) => {
  const trimmed = (value || '').trim()
  return trimmed ? Array.from(trimmed).slice(0, 1).join('') : fallback
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    /* 身份区 */
    logged: false,
    nickname: '访客',
    avatarUrl: '',
    showAvatarImage: false,
    avatarLabel: 'ME',
    levelName: '',
    levelCode: '',
    growthValue: 0,
    nextLevelName: '',
    nextGap: 0,
    progressPercent: 0,
    levels: [] as LevelCard[],
    /* 资产区 */
    couponCount: 0,
    walletText: formatMoney(0),
    points: 0,
    hasGoldCard: false,
    unread: 0,
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    this.refresh()
  },

  async refresh() {
    const session = getSession()
    const member = getCurrentMember()
    const nickname = member ? member.nickname : session ? session.nickname : '访客'
    const avatarUrl = member ? member.avatarUrl : session ? session.avatarUrl : ''
    const base = {
      logged: isVisitorSession(),
      nickname,
      avatarUrl,
      showAvatarImage: !!avatarUrl,
      avatarLabel: getMonogram(nickname, 'ME'),
    }

    if (!base.logged) {
      this.setData({ ...base, levelName: '', growthValue: 0 })
      return
    }

    this.setData(base)

    /* 并行拉档案 + 资产 */
    try {
      const [profile, assets] = await Promise.all([
        getMemberProfileCloud().catch(() => null),
        listAssetsCloud().catch(() => null),
      ])

      if (profile) {
        const levels = profile.levels || []
        const currentThreshold = levels
          .filter((item) => item.threshold <= Number(profile.growthValue || 0))
          .reduce((max, item) => Math.max(max, item.threshold), 0)
        const nextThreshold = levels.find((item) => item.threshold > Number(profile.growthValue || 0))
        const span = nextThreshold ? nextThreshold.threshold - currentThreshold : 0
        const progressed = Number(profile.growthValue || 0) - currentThreshold
        this.setData({
          levelName: profile.levelName || '',
          levelCode: profile.nextLevel || levels.length && levels[levels.length - 1].level || '',
          growthValue: Number(profile.growthValue || 0),
          nextLevelName: nextThreshold ? `${nextThreshold.level} ${nextThreshold.name}` : '已满级',
          nextGap: Number(profile.nextGap || 0),
          progressPercent:
            span > 0 ? Math.min(100, Math.round((progressed / span) * 100)) : 100,
          levels,
        })
      }
      try {
        const notifications = (await notifyListCloud().catch(() => null)) || { items: [], unread: 0 }
        this.setData({ unread: Number(notifications.unread || 0) })
      } catch (error) {
        /* 静默 */
      }
      if (assets) {
        const usableCoupons = (assets.coupons || []).filter((coupon) => coupon.status === 'UNUSED')
        this.setData({
          couponCount: usableCoupons.length,
          walletText: formatMoney(Number(assets.wallet || 0)),
          points: Number(assets.points || 0),
          hasGoldCard: (assets.cards || []).some((card) => card.status === 'ACTIVE'),
        })
      }
    } catch (error) {
      console.warn('[profile] cloud enrich skipped', error)
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/index/index' })
  },

  goProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/index' })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将返回登录页，确认退出？',
      confirmText: '退出',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (!res.confirm) return
        clearCart()
        clearSession(true)
        wx.reLaunch({ url: '/pages/index/index' })
      },
    })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/orders/index' })
  },

  goCoupons() {
    wx.navigateTo({ url: '/pages/coupons/index' })
  },

  goWallet() {
    wx.navigateTo({ url: '/pages/wallet/index' })
  },

  goRedeem() {
    wx.navigateTo({ url: '/pages/redeem/index' })
  },

  goBenefits() {
    wx.navigateTo({ url: '/pages/benefits/index' })
  },

  goNotifications() { wx.navigateTo({ url: '/pages/notifications/index' }) },
  goCs() { wx.navigateTo({ url: '/pages/cs-chat/index' }) },
  goGroupmeal() { wx.navigateTo({ url: '/pages/groupmeal/index' }) },
  goInvoice() { wx.navigateTo({ url: '/pages/invoice/index' }) },
  goPolicies() { wx.navigateTo({ url: '/pages/policies/index' }) },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  comingSoon(event: WechatMiniprogram.BaseEvent) {
    const label = (event.currentTarget.dataset.label as string) || ''
    wx.showToast({ title: `${label}即将上线`, icon: 'none' })
  },
})
