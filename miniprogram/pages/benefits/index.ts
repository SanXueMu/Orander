import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { listBenefitsCloud, type BenefitItem } from '../../utils/cloud'
import { benefitMetaOf, type BenefitMeta } from '../../utils/xc-benefits'

type BenefitView = BenefitMeta & {
  claimed: boolean
  cloudDescription: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    benefits: [] as BenefitView[],
    loading: true,
    cloudOk: true,
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
      const result = await listBenefitsCloud()
      const items = (result && result.items ? result.items : []) as BenefitItem[]
      const claimedCodes = new Set((result && result.claimed ? result.claimed : []).map((row) => row.code))
      /* 云端条目为主，前端 meta 文案兜底补充 */
      const seen = new Set<string>()
      const views: BenefitView[] = []
      items.forEach((item) => {
        if (!item || item.status !== 'ACTIVE') {
          return
        }
        seen.add(item.code)
        const meta = benefitMetaOf(item.code)
        views.push({ ...meta, name: item.name || meta.name, claimed: claimedCodes.has(item.code), cloudDescription: item.description || '' })
      })
      this.setData({ benefits: views, loading: false, cloudOk: true })
    } catch (error) {
      console.error('[benefits] refresh failed', error)
      /* 云端不可用时仍展示静态福利卡片（claim 会提示登录/部署） */
      this.setData({
        benefits: ['GOLD_CARD', 'MONDAY_FREE_FEE', 'NEWBIE_20'].map((code) => ({
          ...benefitMetaOf(code),
          claimed: false,
          cloudDescription: '',
        })),
        loading: false,
        cloudOk: false,
      })
    }
  },

  openDetail(event: WechatMiniprogram.BaseEvent) {
    const code = event.currentTarget.dataset.code as string
    wx.navigateTo({ url: `/pages/benefit-detail/index?code=${code}` })
  },
})
