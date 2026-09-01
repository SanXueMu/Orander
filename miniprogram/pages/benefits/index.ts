import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { listBenefitsCloud, type BenefitItem } from '../../utils/cloud'
import { BENEFIT_META, type BenefitMeta } from '../../utils/xc-benefits'

type BenefitView = BenefitMeta & {
  claimed: boolean
  cloudDescription: string
}

const REMIND_KEY = 'orander-benefit-remind'

Page({
  behaviors: [pageLookBehavior],

  data: {
    benefits: [] as BenefitView[],
    loading: true,
    cloudOk: true,
    remindOn: false,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.navigateTo({ url: '/pages/profile-edit/index' })
      return
    }
    applyPageLook(this, getCurrentMember())
    this.setData({ remindOn: wx.getStorageSync(REMIND_KEY) === 'on' })
    this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const result = await listBenefitsCloud()
      const items = (result && result.items ? result.items : []) as BenefitItem[]
      const claimedCodes = new Set((result && result.claimed ? result.claimed : []).map((row) => row.code))
      const cloudMap = new Map<string, BenefitItem>()
      items.forEach((item) => {
        if (item && item.status === 'ACTIVE') {
          cloudMap.set(item.code, item)
        }
      })
      /* 本地 meta 为基座（保证新增福利可见），云端覆盖名称/描述/领取态 */
      const views: BenefitView[] = BENEFIT_META.map((meta) => {
        const row = cloudMap.get(meta.code)
        return {
          ...meta,
          name: (row && row.name) || meta.name,
          claimed: claimedCodes.has(meta.code),
          cloudDescription: (row && row.description) || '',
        }
      })
      this.setData({ benefits: views, loading: false, cloudOk: true })
    } catch (error) {
      console.error('[benefits] refresh failed', error)
      /* 云端不可用时仍展示静态福利卡片（claim 会提示登录/部署） */
      this.setData({
        benefits: BENEFIT_META.map((meta) => ({ ...meta, claimed: false, cloudDescription: '' })),
        loading: false,
        cloudOk: false,
      })
    }
  },

  toggleRemind() {
    if (this.data.remindOn) {
      wx.removeStorageSync(REMIND_KEY)
      this.setData({ remindOn: false })
      wx.showToast({ title: '已关闭提醒', icon: 'none' })
      return
    }
    wx.setStorageSync(REMIND_KEY, 'on')
    this.setData({ remindOn: true })
    wx.requestSubscribeMessage({
      tmplIds: [],
      complete: () => wx.showToast({ title: '已开启，上新自动提醒', icon: 'none' }),
    })
  },

  openDetail(event: WechatMiniprogram.BaseEvent) {
    const code = event.currentTarget.dataset.code as string
    wx.navigateTo({ url: `/pages/benefit-detail/index?code=${code}` })
  },
})
