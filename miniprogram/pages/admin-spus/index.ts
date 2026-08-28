import { getAdminToken } from '../../utils/orander'
import { fetchCatalogCloud, adminSaveSpuCloud, adminSaveCategoryCloud, type Spu } from '../../utils/cloud'

type SpuRow = Spu & { available: boolean; basePriceText: string; catName: string; specCount: number }

Page({
  data: { cats: [] as Array<{ id: string; name: string }>, spus: [] as SpuRow[], activeCat: '', loading: false },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    const data = await fetchCatalogCloud()
    this.setData({ loading: false })
    if (!data) { return }
    const cats = (data.categories || []).map((cat) => ({ id: cat.id, name: cat.name }))
    const catMap: Record<string, string> = {}
    cats.forEach((cat) => { catMap[cat.id] = cat.name })
    const spus = (data.spus || [])
      .filter((spu) => this.data.activeCat === '' || spu.categoryId === this.data.activeCat)
      .map((spu) => ({
        ...spu,
        available: (spu as Spu & { available?: boolean }).available !== false,
        basePriceText: Number(spu.basePrice || 0).toFixed(2),
        catName: catMap[spu.categoryId] || '未分类',
        specCount: (spu.specGroups || []).length,
      }))
    this.setData({ cats, spus })
  },

  switchCat(event: WechatMiniprogram.Touch) {
    this.setData({ activeCat: String(event.currentTarget.dataset.key || '') })
    this.refresh()
  },

  async patchSpu(spuId: string, patch: Record<string, unknown>) {
    const token = getAdminToken()
    if (!token) { return }
    const data = await fetchCatalogCloud()
    const target = data && (data.spus || []).find((spu) => spu.id === spuId)
    if (!target) {
      wx.showToast({ title: '商品不存在', icon: 'none' })
      return
    }
    await adminSaveSpuCloud(token, { ...target, ...patch } as Record<string, unknown>)
    this.refresh()
  },

  toggleAvailable(event: WechatMiniprogram.Touch) {
    const id = event.currentTarget.dataset.id as string
    const target = this.data.spus.find((spu) => spu.id === id)
    if (target) { void this.patchSpu(id, { available: !target.available }) }
  },

  toggleSoldOut(event: WechatMiniprogram.Touch) {
    const id = event.currentTarget.dataset.id as string
    const target = this.data.spus.find((spu) => spu.id === id)
    if (target) { void this.patchSpu(id, { soldOut: !target.soldOut }) }
  },

  addCat() {
    wx.showModal({
      title: '新建分类',
      editable: true,
      placeholderText: '分类名称',
      success: async (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) { return }
        const token = getAdminToken()
        if (!token) { return }
        await adminSaveCategoryCloud(token, { name: res.content.trim(), order: this.data.cats.length })
        this.refresh()
      },
    })
  },

  addSpu() {
    wx.navigateTo({ url: `/pages/admin-spu-edit/index${this.data.activeCat ? `?cat=${this.data.activeCat}` : ''}` })
  },

  editSpu(event: WechatMiniprogram.Touch) {
    wx.navigateTo({ url: `/pages/admin-spu-edit/index?id=${event.currentTarget.dataset.id}` })
  },
})
