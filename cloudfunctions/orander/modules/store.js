/**
 * store 域：门店列表（LBS 距离）/ 门店菜单差异 / 营业状态
 */
const { col, distanceKm, nowIso } = require('../lib/context')

const mapStore = (doc = {}) => ({
  id: doc.id,
  name: doc.name || '',
  address: doc.address || '',
  lng: Number(doc.lng || 0),
  lat: Number(doc.lat || 0),
  businessHours: doc.businessHours || '10:00-22:00',
  supportPickup: doc.supportPickup !== false,
  supportDelivery: doc.supportDelivery !== false,
  open: doc.open !== false,
})

module.exports = {
  mapStore,

  async getStores(event = {}) {
    const result = await col('stores').limit(50).get()
    let stores = result.data.map(mapStore)
    if (Number(event.lng) && Number(event.lat)) {
      stores = stores.map((store) => ({
        ...store,
        distanceKm: distanceKm(Number(event.lng), Number(event.lat), store.lng, store.lat),
      })).sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999))
    }
    return { stores }
  },

  async getStore(event = {}) {
    const result = await col('stores').where({ id: event.storeId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('门店不存在')
    }
    return mapStore(result.data[0])
  },

  /**
   * 门店菜单：全局 SPU + 门店覆盖（售罄 / 改价）
   */
  async getStoreMenu(event = {}) {
    const [storeResult, spuResult, menuResult] = await Promise.all([
      col('stores').where({ id: event.storeId }).limit(1).get(),
      col('spus').orderBy('soldCount', 'desc').limit(200).get(),
      col('store_menus').where({ storeId: event.storeId }).limit(200).get(),
    ])
    if (storeResult.data.length === 0) {
      throw new Error('门店不存在')
    }
    const overrides = new Map(menuResult.data.map((doc) => [doc.spuId, doc]))
    const spus = spuResult.data.map((doc) => {
      const override = overrides.get(doc.id)
      return {
        ...doc,
        basePrice: override && override.price != null ? Number(override.price) : Number(doc.basePrice || 0),
        soldOut: override ? !!override.soldOut : !!doc.soldOut,
      }
    })
    return { store: mapStore(storeResult.data[0]), spus }
  },

  async setStoreSpuOverride(event = {}) {
    const { storeId, spuId, soldOut, price } = event
    const existing = await col('store_menus').where({ storeId, spuId }).limit(1).get()
    const payload = { storeId, spuId, soldOut: !!soldOut, updatedAt: nowIso() }
    if (price != null) {
      payload.price = Number(price)
    }
    if (existing.data.length) {
      await col('store_menus').where({ storeId, spuId }).update({ data: payload })
    } else {
      await col('store_menus').add({ data: payload })
    }
    return payload
  },

  async saveStore(event = {}) {
    const next = mapStore(event.store || {})
    const existing = await col('stores').where({ id: next.id }).limit(1).get()
    if (existing.data.length) {
      await col('stores').where({ id: next.id }).update({ data: { ...next, updatedAt: nowIso() } })
    } else {
      await col('stores').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  /* ---- 营业状态（旧 action 兼容） ---- */
  async getBusinessStatus() {
    const result = await col('config').where({ key: 'businessStatus' }).limit(1).get()
    if (result.data.length === 0) {
      return { open: true, chefName: '' }
    }
    return { open: !!result.data[0].open, chefName: result.data[0].chefName || '' }
  },

  async setBusinessStatus(event = {}) {
    const open = !!event.open
    const chefName = typeof event.chefName === 'string' ? event.chefName.trim() : undefined
    const existing = await col('config').where({ key: 'businessStatus' }).limit(1).get()
    const payload = { open, updatedAt: nowIso() }
    if (chefName !== undefined) {
      payload.chefName = chefName
    }
    if (existing.data.length === 0) {
      await col('config').add({ data: { key: 'businessStatus', ...payload } })
    } else {
      await col('config').where({ key: 'businessStatus' }).update({ data: payload })
    }
    return { open, chefName: chefName !== undefined ? chefName : existing.data[0].chefName || '' }
  },
}
