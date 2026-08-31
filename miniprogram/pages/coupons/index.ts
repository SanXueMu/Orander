import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { listCouponTemplatesCloud, receiveCouponCloud, listAssetsCloud, type AssetCoupon } from '../../utils/cloud'

type CouponView = {
  id: string
  name: string
  valueText: string
  thresholdText: string
  statusText: string
  expiredText: string
  usable: boolean
}

const mapInstance = (coupon: AssetCoupon): CouponView => {
  const value = Number(coupon.value || 0)
  const threshold = Number(coupon.threshold || 0)
  const usable = coupon.status === 'UNUSED'
  return {
    id: coupon.id,
    name: coupon.name,
    valueText: coupon.type === 'PERCENT' ? `${value} 折` : `¥${value}`,
    thresholdText: threshold > 0 ? `满 ¥${threshold} 可用` : '无门槛',
    statusText: coupon.status === 'USED' ? '已使用' : coupon.status === 'EXPIRED' ? '已过期' : '',
    expiredText: coupon.expiresAt ? `${String(coupon.expiresAt).slice(5, 10).replace('-', '/')} 到期` : '',
    usable,
  }
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    activeTab: 'usable' as 'usable' | 'used',
    coupons: [] as CouponView[],
    templates: [] as Array<{ id: string; name: string; valueText: string; thresholdText: string }>,
    loading: true,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.navigateTo({ url: '/pages/profile-edit/index' })
      return
    }
    applyPageLook(this, getCurrentMember())
    this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const assets = await listAssetsCloud()
      const all = (assets && assets.coupons ? assets.coupons : []).map(mapInstance)
      let templates: Array<{ id: string; name: string; valueText: string; thresholdText: string }> = []
      try {
        const tplResult = await listCouponTemplatesCloud()
        templates = ((tplResult as { items?: Array<Record<string, unknown>> })?.items || [])
          .filter((tpl) => tpl.status === 'ACTIVE')
          .map((tpl) => {
            const value = Number(tpl.value || 0)
            const threshold = Number(tpl.threshold || 0)
            return {
              id: String(tpl.id),
              name: String(tpl.name),
              valueText: tpl.type === 'PERCENT' ? `${value} 折` : `¥${value}`,
              thresholdText: threshold > 0 ? `满 ¥${threshold} 可用` : '无门槛',
            }
          })
      } catch (error) {
        console.warn('[coupons] templates skipped', error)
      }
      const tab = this.data.activeTab
      const filtered = all.filter((coupon) => (tab === 'used' ? !coupon.usable : coupon.usable))
      this.setData({ coupons: filtered, templates, loading: false })
    } catch (error) {
      console.error('[coupons] refresh failed', error)
      this.setData({ loading: false })
      wx.showToast({ title: '云端不可用', icon: 'none' })
    }
  },

  switchTab(event: WechatMiniprogram.BaseEvent) {
    const tab = event.currentTarget.dataset.tab as 'usable' | 'used'
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab }, () => this.refresh())
    }
  },


  useCoupon() {
    /* 下单时服务端自动匹配最优券；此处引导去点单 */
    wx.switchTab({ url: '/pages/dish/index' })
  },

  async receive(event: WechatMiniprogram.BaseEvent) {
    const templateId = event.currentTarget.dataset.id as string
    try {
      await receiveCouponCloud(templateId)
      wx.showToast({ title: '领取成功', icon: 'success' })
      this.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message.replace('Error: ', '') : '领取失败'
      wx.showToast({ title: message, icon: 'none' })
    }
  },

  goDish() {
    wx.switchTab({ url: '/pages/dish/index' })
  },
})
