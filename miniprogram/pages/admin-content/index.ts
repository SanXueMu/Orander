import { getAdminToken } from '../../utils/orander'
import {
  getBannersCloud,
  adminListActivitiesCloud, adminSaveActivityCloud, adminDeleteActivityCloud,
  getPoliciesCloud, savePolicyCloud,
  adminSaveBannerCloud, adminDeleteBannerCloud,
} from '../../utils/cloud'

type ActivityRow = Record<string, unknown> & {
  id: string; title?: string; template?: string; startDate?: string; endDate?: string; order?: number; status?: string
}
type PolicyRow = Record<string, unknown> & { id: string; title?: string; version?: string }

const TEMPLATE_LABEL: Record<string, string> = {
  NEW_PRODUCT: '新品首发', ANNIVERSARY: '周年庆', SELLING_POINT: '单品卖点', INVITE_MEMBER: '邀请有礼', GENERIC: '通用',
}

Page({
  data: {
    tab: 'act' as 'act' | 'policy' | 'banner',
    loading: true,
    activities: [] as ActivityRow[],
    policies: [] as PolicyRow[],
    editing: false as boolean,
    form: { id: '', title: '', subtitle: '', template: 'NEW_PRODUCT', startDate: '', endDate: '', order: '0', status: 'ON', heroImage: '' },
    policyEditingId: '',
    policyBody: '',
    banners: [] as Array<Record<string, unknown> & { id: string; place?: string; title?: string; image?: string; link?: string; order?: number; status?: string }>,
    bannerEditing: false as boolean,
    bannerForm: { id: '', place: 'dish', title: '', image: '', link: '', order: '0', status: 'ON' } as { id: string; place: string; title: string; image: string; link: string; order: string; status: string },
  },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    void this.refresh()
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: String(event.currentTarget.dataset.tab) as 'act' | 'policy' })
  },

  async refresh() {
    this.setData({ loading: true })
    const token = getAdminToken()
    if (!token) return
    const [actData, policyData, bannerData] = await Promise.all([
      adminListActivitiesCloud(token).catch(() => null),
      getPoliciesCloud().catch(() => null),
      Promise.all(['dish', 'mall', 'home'].map((pl) => getBannersCloud(pl).catch(() => null))),
    ])
    this.setData({
      activities: ((actData && actData.activities) || []) as ActivityRow[],
      policies: ((policyData && policyData.items) || []) as unknown as PolicyRow[],
      banners: ((bannerData || []).flatMap((r) => (r && r.items) || [])) as typeof this.data.banners,
      loading: false,
    })
  },

  startCreate() {
    this.setData({
      editing: true,
      form: { id: '', title: '', subtitle: '', template: 'NEW_PRODUCT', startDate: '', endDate: '', order: '0', status: 'ON', heroImage: '' },
    })
  },

  startEdit(event: WechatMiniprogram.TouchEvent) {
    const activity = this.data.activities.find((item) => item.id === String(event.currentTarget.dataset.id))
    if (!activity) return
    this.setData({
      editing: true,
      form: {
        id: activity.id,
        title: String(activity.title || ''),
        subtitle: String(activity.subtitle || ''),
        template: String(activity.template || 'NEW_PRODUCT'),
        startDate: String(activity.startDate || ''),
        endDate: String(activity.endDate || ''),
        order: String(activity.order ?? 0),
        status: String(activity.status || 'ON'),
        heroImage: String(activity.heroImage || ''),
      },
    })
  },

  onForm(event: WechatMiniprogram.Input) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ [`form.${key}`]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  onTemplate(event: WechatMiniprogram.PickerChange) {
    const keys = Object.keys(TEMPLATE_LABEL)
    this.setData({ 'form.template': keys[Number(event.detail.value)] || 'NEW_PRODUCT' })
  },

  onDate(event: WechatMiniprogram.PickerChange) {
    const key = String(event.currentTarget.dataset.key)
    this.setData({ [`form.${key}`]: String(event.detail.value) } as unknown as WechatMiniprogram.IAnyObject)
  },

  async saveActivity() {
    const token = getAdminToken()
    if (!token || !this.data.form.title.trim()) {
      wx.showToast({ title: '请填标题', icon: 'none' })
      return
    }
    await adminSaveActivityCloud(token, { ...this.data.form, order: Number(this.data.form.order) || 0 })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ editing: false })
    void this.refresh()
  },

  cancelEdit() {
    this.setData({ editing: false })
  },

  async removeActivity(event: WechatMiniprogram.TouchEvent) {
    const token = getAdminToken()
    const id = String(event.currentTarget.dataset.id)
    if (!token || !id) return
    await adminDeleteActivityCloud(token, id)
    wx.showToast({ title: '已删除', icon: 'none' })
    void this.refresh()
  },

  startPolicy(event: WechatMiniprogram.TouchEvent) {
    const policy = this.data.policies.find((item) => item.id === String(event.currentTarget.dataset.id))
    if (!policy) return
    this.setData({ policyEditingId: policy.id, policyBody: String(policy.contentHtml || policy.body || '') })
  },

  onPolicyBody(event: WechatMiniprogram.Input) {
    this.setData({ policyBody: event.detail.value })
  },

  async savePolicyBody() {
    const token = getAdminToken()
    const policy = this.data.policies.find((item) => item.id === this.data.policyEditingId)
    if (!token || !policy) return
    await savePolicyCloud({ ...policy, contentHtml: this.data.policyBody, body: this.data.policyBody })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ policyEditingId: '' })
    void this.refresh()
  },

  onStatusPick(event: WechatMiniprogram.PickerChange) {
    this.setData({ 'form.status': Number(event.detail.value) === 1 ? 'OFF' : 'ON' })
  },

  onHeroImage(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.heroImage': event.detail.value })
  },

  /* ---- banner 管理（R8） ---- */
  startBannerCreate() {
    this.setData({ bannerEditing: true, bannerForm: { id: '', place: 'dish', title: '', image: '', link: '', order: '0', status: 'ON' } })
  },

  startBannerEdit(event: WechatMiniprogram.TouchEvent) {
    const banner = this.data.banners.find((item) => item.id === String(event.currentTarget.dataset.id))
    if (!banner) return
    this.setData({
      bannerEditing: true,
      bannerForm: {
        id: banner.id,
        place: String(banner.place || 'dish'),
        title: String(banner.title || ''),
        image: String(banner.image || ''),
        link: String(banner.link || ''),
        order: String(banner.order ?? 0),
        status: String(banner.status || 'ON'),
      },
    })
  },

  onBannerForm(event: WechatMiniprogram.Input) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ [`bannerForm.${key}`]: event.detail.value } as unknown as WechatMiniprogram.IAnyObject)
  },

  onBannerPlace(event: WechatMiniprogram.PickerChange) {
    const places = ['dish', 'mall', 'home']
    this.setData({ 'bannerForm.place': places[Number(event.detail.value)] || 'dish' })
  },

  onBannerStatus(event: WechatMiniprogram.PickerChange) {
    this.setData({ 'bannerForm.status': Number(event.detail.value) === 1 ? 'OFF' : 'ON' })
  },

  onBannerImage(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'bannerForm.image': event.detail.value })
  },

  async saveBanner() {
    const token = getAdminToken()
    if (!token) return
    await adminSaveBannerCloud(token, { ...this.data.bannerForm, order: Number(this.data.bannerForm.order) || 0 })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ bannerEditing: false })
    void this.refresh()
  },

  async removeBanner(event: WechatMiniprogram.TouchEvent) {
    const token = getAdminToken()
    const id = String(event.currentTarget.dataset.id)
    if (!token || !id) return
    await adminDeleteBannerCloud(token, id)
    wx.showToast({ title: '已删除', icon: 'none' })
    void this.refresh()
  },

  cancelPolicy() {
    this.setData({ policyEditingId: '', policyBody: '' })
  },

  templateLabel(value?: string) {
    return TEMPLATE_LABEL[String(value || 'GENERIC')] || '通用'
  },
})
