import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { claimBenefitCloud, listBenefitsCloud } from '../../utils/cloud'
import { benefitMetaOf, type BenefitMeta } from '../../utils/xc-benefits'

Page({
  behaviors: [pageLookBehavior],

  data: {
    meta: benefitMetaOf('') as BenefitMeta,
    cloud: { image: '', heroTitle: '', title: '', subtitle: '' },
    claimed: false,
    claiming: false,
    cloudOk: true,
  },

  onLoad(options: Record<string, string>) {
    const meta = benefitMetaOf(options.code || '')
    this.setData({ meta })
    applyPageLook(this, getCurrentMember())
    this.checkClaimed()
  },

  async checkClaimed() {
    try {
      const result = await listBenefitsCloud()
      const rows = (result && result.items) || []
      const row = rows.find((item) => item.code === this.data.meta.code)
      const cloud = row
        ? {
            image: row.image || '',
            heroTitle: row.heroTitle || '',
            title: row.title || '',
            subtitle: row.subtitle || '',
          }
        : this.data.cloud
      const claimed = (result && result.claimed ? result.claimed : []).some((claim) => claim.code === this.data.meta.code)
      this.setData({ claimed, cloud, cloudOk: true })
    } catch (error) {
      console.warn('[benefit-detail] check skipped', error)
      this.setData({ cloudOk: false })
    }
  },

  async claim() {
    if (this.data.claiming || this.data.claimed) {
      return
    }
    if (!isVisitorSession()) {
      wx.navigateTo({ url: '/pages/profile-edit/index' })
      return
    }
    this.setData({ claiming: true })
    try {
      await claimBenefitCloud(this.data.meta.code)
      this.setData({ claimed: true, claiming: false })
      wx.showToast({ title: '领取成功', icon: 'success' })
    } catch (error) {
      this.setData({ claiming: false })
      const message = error instanceof Error ? String(error.message || error).replace('Error: ', '') : '领取失败'
      wx.showToast({ title: message.includes('：') ? message.split('：').pop()! : message, icon: 'none' })
    }
  },
})
