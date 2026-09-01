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
    agreed: false,
    rulesOpen: false,
    mondayLive: false,
    newbieCoupons: [4, 6, 10],
    goldenPerks: [
      { v: '¥8', t: '首杯立减' },
      { v: '88折', t: '整单优惠' },
      { v: '免运费', t: '喜外送单' },
    ],
    goldenDrinks: [
      { name: '多肉葡萄', price: '18.5' },
      { name: '绿妍轻乳', price: '15.8' },
      { name: '芝士波波', price: '16.8' },
      { name: '轻因美式', price: '14.2' },
    ],
    warmPeriod: '2026/07 - 2026/12 每月可领',
    warmTips: ['优先选择温热适口的茶饮，避免空腹饮用浓茶。', '特殊时期建议低因或花草茶底，舒适为先。', '每杯含茶饮适量为宜，好心情慢慢品。'],
    studentSteps: [
      '进入「我的 → 账户」完成登录',
      '在会员信息页填写学校与学号',
      '上传学生证或在读证明照片',
      '等待系统审核（通常 1 个工作日）',
      '审核通过后卡片自动激活',
      '周五至周日下单自动享受权益',
    ],
  },

  onLoad(options: Record<string, string>) {
    const meta = benefitMetaOf(options.code || '')
    const day = new Date().getDay()
    this.setData({ meta, mondayLive: day === 1 })
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

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  toggleRules() {
    this.setData({ rulesOpen: !this.data.rulesOpen })
  },

  invite() {
    wx.setClipboardData({
      data: 'Orander GO 会员福利「暖心为你」每月 8.8 折，快来一起领 →',
      success: () => wx.showToast({ title: '邀请文案已复制', icon: 'none' }),
    })
  },

  middleSchool() {
    wx.showModal({
      title: '中学生专属',
      content: '凭学生证到店可享指定饮品第二杯半价，具体以门店公示为准。',
      showCancel: false,
      confirmText: '知道了',
    })
  },

  buyGolden() {
    if (this.data.claimed || this.data.claiming) {
      return
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选开通须知', icon: 'none' })
      return
    }
    void this.claim()
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
      wx.showToast({ title: this.data.meta.layout === 'GOLDEN' ? '开卡成功' : '领取成功', icon: 'success' })
    } catch (error) {
      this.setData({ claiming: false })
      const message = error instanceof Error ? String(error.message || error).replace('Error: ', '') : '领取失败'
      wx.showToast({ title: message.includes('：') ? message.split('：').pop()! : message, icon: 'none' })
    }
  },
})
