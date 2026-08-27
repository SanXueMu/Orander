/**
 * mall 域：百货楼层 / 商品（订单走 trade 的 biz=MALL）
 */
const { col, nowIso } = require('../lib/context')

module.exports = {
  async getMallFloors() {
    const result = await col('mall_products').where({ status: 'ON' }).orderBy('floorOrder', 'asc').limit(200).get()
    const products = result.data.map((doc) => ({
      id: doc.id,
      name: doc.name || '',
      floor: doc.floor || 'new',
      floorName: doc.floorName || '',
      price: Number(doc.price || 0),
      originalPrice: Number(doc.originalPrice || 0),
      image: doc.image || '',
      stock: Number(doc.stock || 0),
      soldCount: Number(doc.soldCount || 0),
    }))
    const floorDefs = [
      { key: 'new', title: '灵感上新' },
      { key: 'bottle', title: '喜茶瓶装' },
      { key: 'gift', title: '茶礼盒' },
      { key: 'goods', title: '灵感周边' },
    ]
    const floors = floorDefs.map((floor) => ({
      ...floor,
      products: products.filter((product) => product.floor === floor.key),
    })).filter((floor) => floor.products.length > 0)
    return { floors }
  },

  async getMallProducts(event = {}) {
    const query = { status: 'ON' }
    if (event.floor) {
      query.floor = event.floor
    }
    const result = await col('mall_products').where(query).orderBy('soldCount', 'desc').limit(100).get()
    return { items: result.data }
  },

  async getMallProduct(event = {}) {
    const result = await col('mall_products').where({ id: event.productId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('商品不存在')
    }
    return result.data[0]
  },

  /* ---- admin ---- */
  async saveMallProduct(event = {}) {
    const next = {
      id: (event.product && event.product.id) || `mall-${Date.now()}`,
      ...(event.product || {}),
      updatedAt: nowIso(),
    }
    const existing = await col('mall_products').where({ id: next.id }).limit(1).get()
    if (existing.data.length) {
      await col('mall_products').where({ id: next.id }).update({ data: next })
    } else {
      await col('mall_products').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  async setMallStock(event = {}) {
    await col('mall_products').where({ id: event.productId }).update({
      data: { stock: Number(event.stock || 0) },
    })
    return { id: event.productId, stock: Number(event.stock || 0) }
  },
}
