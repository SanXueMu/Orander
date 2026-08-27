import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember, getSession } from '../../utils/orander'
import {
  invApplyCloud, invDeleteTitleCloud, invListOrdersCloud,
  invListRecordsCloud, invListTitlesCloud, invSaveTitleCloud,
  type TitleRecord,
} from '../../utils/cloud'

const nn = <T>(value: T | null | undefined, fallback: T): T => (value === null || value === undefined ? fallback : value)

const BIZ_LINES = ['茶饮订单', '百货商城', '团餐', '储值卡', '周边礼品', '外卖配送', '其他']

Page({
  behaviors: [pageLookBehavior],

  data: {
    tab: 'apply',
    tabs: [
      { key: 'apply', label: '开票' },
      { key: 'title', label: '抬头管理' },
      { key: 'record', label: '开票记录' },
    ],
    bizLines: BIZ_LINES,
    activeBiz: BIZ_LINES[0],
    orders: [] as Array<{ id: string; orderNumber: string; payAmount: number; picked?: boolean }>,
    titles: [] as TitleRecord[],
    activeTitleId: '',
    newTitleName: '',
    newTitleTaxNo: '',
    records: [] as Array<Record<string, unknown>>,
    prefillOrderId: '',
    submitting: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    if (query.orderId) {
      this.setData({ prefillOrderId: query.orderId })
    }
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    void this.refresh()
  },

  switchTab(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ tab: key })
    void this.refresh()
  },

  async refresh() {
    if (!getSession()) return
    try {
      if (this.data.tab === 'apply') {
        const orderData = nn(await invListOrdersCloud().catch(() => null), { items: [] })
        const titleData = nn(await invListTitlesCloud().catch(() => null), { items: [] })

        const orders: Array<{ id: string; orderNumber: string; payAmount: number; createdAt?: string; picked?: boolean }> = (orderData.items || []).map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          payAmount: order.payAmount,
          createdAt: order.createdAt,
          picked: order.id === this.data.prefillOrderId,
        }))
        this.setData({ orders, titles: titleData.items || [], activeTitleId: this.data.activeTitleId || ((titleData.items || [])[0] || { id: '' }).id })
      } else if (this.data.tab === 'title') {
        const titleData2 = nn(await invListTitlesCloud().catch(() => null), { items: [] })
        this.setData({ titles: titleData2.items || [] })
      } else {
        const recordRes = (await invListRecordsCloud().catch(() => null)) || { items: [] }
        this.setData({ records: recordRes.items as Array<Record<string, unknown>> })
      }
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  pickOrder(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    this.setData({
      orders: this.data.orders.map((o) => (o.id === id ? { ...o, picked: !o.picked } : o)),
    })
  },

  pickBiz(event: WechatMiniprogram.BaseEvent) {
    this.setData({ activeBiz: event.currentTarget.dataset.line as string })
  },

  pickTitle(event: WechatMiniprogram.BaseEvent) {
    this.setData({ activeTitleId: event.currentTarget.dataset.id as string })
  },

  onTitleName(event: WechatMiniprogram.Input) { this.setData({ newTitleName: event.detail.value }) },
  onTitleTaxNo(event: WechatMiniprogram.Input) { this.setData({ newTitleTaxNo: event.detail.value }) },

  async addTitle() {
    const name = this.data.newTitleName.trim()
    if (!name) {
      wx.showToast({ title: '请填写抬头名称', icon: 'none' })
      return
    }
    try {
      const saved = nn(await invSaveTitleCloud({ name, taxNo: this.data.newTitleTaxNo.trim() }), { id: '', name })
      this.setData({
        newTitleName: '',
        newTitleTaxNo: '',
        activeTitleId: saved.id,
        titles: [...this.data.titles, saved],
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async removeTitle(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    try {
      await invDeleteTitleCloud(id)
      await this.refresh()
    } catch (error) {
      /* 静默 */
    }
  },

  async apply() {
    const ids = this.data.orders.filter((o) => o.picked).map((o) => o.id)
    if (!ids.length) {
      wx.showToast({ title: '请选择订单', icon: 'none' })
      return
    }
    const title = this.data.titles.find((t) => t.id === this.data.activeTitleId)
    if (!title) {
      wx.showToast({ title: '请选择或新增抬头', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      await invApplyCloud({ orderIds: ids, titleId: title.id, bizLine: this.data.activeBiz })
      wx.showToast({ title: '已提交申请', icon: 'success' })
      this.setData({ tab: 'record' })
      void this.refresh()
    } catch (error) {
      wx.showToast({ title: (error as Error).message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
