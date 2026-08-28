import { getAdminToken } from '../../utils/orander'
import { fetchStoresCloud, fetchCatalogCloud, adminSaveStoreCloud, adminSetStoreOverrideCloud, type StoreInfo, type Spu } from '../../utils/cloud'

type MenuSpu = Spu & { soldOutHere: boolean }
type StoreRow = StoreInfo & { open: boolean; businessHours: string; supportPickup?: boolean; supportDelivery?: boolean; menuOpen: boolean; menuSpus: MenuSpu[] }

Page({
  data: { stores: [] as StoreRow[], overrides: {} as Record<string, boolean> },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    this.refresh()
  },

  async refresh() {
    const data = await fetchStoresCloud()
    if (!data) { return }
    const stores = (data.stores || []).map((store) => ({
      ...store,
      open: (store as StoreInfo & { open?: boolean }).open !== false,
      businessHours: (store as StoreInfo & { businessHours?: string }).businessHours || '10:00-22:00',
      menuOpen: false,
      menuSpus: [] as MenuSpu[],
    })) as StoreRow[]
    this.setData({ stores })
  },

  async toggleOpen(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    const id = event.currentTarget.dataset.id as string
    const target = this.data.stores.find((store) => store.id === id)
    if (!token || !target) { return }
    await adminSaveStoreCloud(token, { ...target, open: !target.open })
    this.refresh()
  },

  editStore(event: WechatMiniprogram.Touch) {
    const id = event.currentTarget.dataset.id as string
    const target = this.data.stores.find((store) => store.id === id)
    if (!target) { return }
    wx.showModal({
      title: '编辑门店',
      editable: true,
      placeholderText: '门店名称',
      content: target.name,
      success: async (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) { return }
        const token = getAdminToken()
        if (!token) { return }
        await adminSaveStoreCloud(token, { ...target, name: res.content.trim() })
        this.refresh()
      },
    })
  },

  async toggleMenu(event: WechatMiniprogram.Touch) {
    const index = Number(event.currentTarget.dataset.index)
    const store = this.data.stores[index]
    const opening = !store.menuOpen
    this.setData({ [`stores[${index}].menuOpen`]: opening })
    if (opening && !store.menuSpus.length) {
      const [storeData, catalog] = await Promise.all([fetchStoresCloud(), fetchCatalogCloud()])
      if (!storeData || !catalog) { return }
      const fresh = (storeData.stores || []).find((item) => item.id === store.id)
      const spus = (catalog.spus || []).filter((spu) => (spu as Spu & { available?: boolean }).available !== false)
      const overridden = (fresh && (fresh as unknown as { menu?: Record<string, unknown> }).menu) || {}
      const menuSpus = spus.map((spu) => ({
        ...spu,
        soldOutHere: !!(overridden[spu.id] && (overridden[spu.id] as { soldOut?: boolean }).soldOut),
      }))
      this.setData({ [`stores[${index}].menuSpus`]: menuSpus })
    }
  },

  async toggleSpuSoldOut(event: WechatMiniprogram.Touch) {
    const token = getAdminToken()
    const storeId = event.currentTarget.dataset.store as string
    const spuId = event.currentTarget.dataset.spu as string
    const index = Number(event.currentTarget.dataset.index)
    const spu = this.data.stores[index].menuSpus.find((item) => item.id === spuId)
    if (!token || !spu) { return }
    const next = !spu.soldOutHere
    await adminSetStoreOverrideCloud(token, storeId, spuId, { soldOut: next })
    this.setData({ [`stores[${index}].menuSpus[${this.data.stores[index].menuSpus.findIndex((item) => item.id === spuId)}].soldOutHere`]: next })
  },

  addStore() {
    wx.showModal({
      title: '新门店',
      editable: true,
      placeholderText: '门店名称',
      success: async (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) { return }
        const token = getAdminToken()
        if (!token) { return }
        await adminSaveStoreCloud(token, { name: res.content.trim(), address: '地址待补充', businessHours: '10:00-22:00', open: true })
        this.refresh()
      },
    })
  },
})
