import { getAdminToken } from '../../utils/orander'
import {
  adminListCouponTemplatesCloud, adminCreateCouponTemplateCloud, adminCreateCodeBatchCloud,
  adminGrantCouponCloud, adminGetSlotsCloud, adminSetSlotCapacityCloud, adminListReservationsCloud,
  adminListBenefitsCloud, adminSaveBenefitCloud,
} from '../../utils/cloud'

type CouponTpl = Record<string, unknown> & { id: string; name: string; type: string; value: number; threshold: number; total: number; issued: number }
type SlotRow = Record<string, unknown> & { id: string; label?: string; capacity: number; reserved: number }

Page({
  data: {
    tab: 'coupon' as 'coupon' | 'code' | 'grant' | 'gm' | 'benefit',
    tplImage: '',
    benefits: [] as Array<Record<string, unknown> & { code?: string; title?: string; subtitle?: string; image?: string; heroTitle?: string; status?: string }>,
    benefitEditing: '' as string,
    loading: true,
    templates: [] as CouponTpl[],
    tplName: '',
    tplType: 'AMOUNT',
    tplValue: '5',
    tplThreshold: '30',
    tplDays: '30',
    tplTotal: '100',
    tplLimit: '1',
    codeCount: '20',
    codeValue: '100',
    codeResult: '',
    grantTplIndex: 0,
    grantOpenIds: '',
    grantResult: '',
    gmDate: '',
    slots: [] as SlotRow[],
    reservations: [] as Array<Record<string, unknown>>,
  },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    if (!this.data.gmDate) {
      this.setData({ gmDate: new Date().toISOString().slice(0, 10) })
    }
    void this.refresh()
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = String((event.currentTarget.dataset.tab || 'coupon'))
    this.setData({ tab: tab as 'coupon' | 'code' | 'grant' | 'gm' | 'benefit' })
    if (tab === 'benefit') void this.loadBenefits()
    if (tab === 'gm') void this.loadGm()
    if (tab === 'grant') this.setData({ grantTplIndex: 0 })
  },

  async refresh() {
    this.setData({ loading: true })
    const token = getAdminToken()
    if (!token) return
    const data = await adminListCouponTemplatesCloud(token).catch(() => null)
    this.setData({ templates: ((data && data.items) || []) as CouponTpl[], loading: false })
  },

  onField(event: WechatMiniprogram.Input) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ [key]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  onTplTypePick(event: WechatMiniprogram.PickerChange) {
    this.setData({ tplType: Number(event.detail.value) === 1 ? 'PERCENT' : 'AMOUNT' })
  },

  onTplPick(event: WechatMiniprogram.PickerChange) {
    this.setData({ grantTplIndex: Number(event.detail.value) || 0 })
  },

  async createTemplate() {
    const token = getAdminToken()
    if (!token || !this.data.tplName.trim()) {
      wx.showToast({ title: '请填写券名', icon: 'none' })
      return
    }
    await adminCreateCouponTemplateCloud(token, {
      name: this.data.tplName.trim(),
      type: this.data.tplType,
      value: Number(this.data.tplValue) || 0,
      threshold: Number(this.data.tplThreshold) || 0,
      validDays: Number(this.data.tplDays) || 30,
      total: Number(this.data.tplTotal) || 0,
      limitPerUser: Number(this.data.tplLimit) || 1,
      image: this.data.tplImage,
    })
    wx.showToast({ title: '已创建', icon: 'success' })
    this.setData({ tplName: '', tplImage: '' })
    void this.refresh()
  },

  onTplImage(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ tplImage: event.detail.value })
  },

  /* ---- 福利管理（R8 手绘配图） ---- */
  async loadBenefits() {
    const token = getAdminToken()
    if (!token) return
    const data = await adminListBenefitsCloud(token).catch(() => null)
    this.setData({ benefits: ((data && data.items) || []) as typeof this.data.benefits })
  },

  toggleBenefit(event: WechatMiniprogram.TouchEvent) {
    const code = String(event.currentTarget.dataset.code || '')
    this.setData({ benefitEditing: this.data.benefitEditing === code ? '' : code })
  },

  onBenefitField(event: WechatMiniprogram.Input) {
    const idx = Number(event.currentTarget.dataset.idx)
    const key = event.currentTarget.dataset.key as string
    this.setData({ [`benefits[${idx}].${key}`]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  onBenefitImage(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const idx = Number(event.currentTarget.dataset.idx)
    this.setData({ [`benefits[${idx}].image`]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  onBenefitHero(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const idx = Number(event.currentTarget.dataset.idx)
    this.setData({ [`benefits[${idx}].heroTitle`]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  async saveBenefitRow(event: WechatMiniprogram.TouchEvent) {
    const token = getAdminToken()
    const idx = Number(event.currentTarget.dataset.idx)
    const row = this.data.benefits[idx]
    if (!token || !row || !row.code) return
    await adminSaveBenefitCloud(token, row)
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ benefitEditing: '' })
  },

  async createCodes() {
    const token = getAdminToken()
    if (!token) return
    const result = await adminCreateCodeBatchCloud(token, {
      count: Number(this.data.codeCount) || 10,
      rewardType: 'POINTS',
      rewardValue: Number(this.data.codeValue) || 100,
    })
    const codes = (result && result.codes) || []
    this.setData({ codeResult: codes.join('\n') })
    wx.showToast({ title: `已生成 ${codes.length} 枚`, icon: 'success' })
  },

  copyCodes() {
    if (!this.data.codeResult) return
    wx.setClipboardData({ data: this.data.codeResult })
  },

  async grantCoupons() {
    const token = getAdminToken()
    if (!token) return
    const template = this.data.templates[this.data.grantTplIndex]
    if (!template) {
      wx.showToast({ title: '无可用模板', icon: 'none' })
      return
    }
    const openIds = this.data.grantOpenIds.split(/[\n,，\s]+/).map((item) => item.trim()).filter(Boolean)
    if (!openIds.length) {
      wx.showToast({ title: '填写 openId', icon: 'none' })
      return
    }
    const result = await adminGrantCouponCloud(token, template.id, openIds).catch(() => null)
    const issued = result && result.issued
    this.setData({ grantResult: issued !== undefined && issued !== null ? `成功发放 ${issued} 张「${template.name}」` : '发放失败' })
  },

  async loadGm() {
    const token = getAdminToken()
    if (!token) return
    const [slotData, reservationData] = await Promise.all([
      adminGetSlotsCloud(token, this.data.gmDate).catch(() => null),
      adminListReservationsCloud(token, this.data.gmDate).catch(() => null),
    ])
    this.setData({
      slots: ((slotData && slotData.slots) || []) as SlotRow[],
      reservations: (reservationData && reservationData.items) || [],
    })
  },

  onGmDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ gmDate: String(event.detail.value) })
    void this.loadGm()
  },

  async onCapacity(event: WechatMiniprogram.Input) {
    const slotId = String(event.currentTarget.dataset.id || '')
    const capacity = Number(event.detail.value) || 0
    const token = getAdminToken()
    if (!token || !slotId) return
    await adminSetSlotCapacityCloud(token, slotId, capacity)
    void this.loadGm()
  },
})
