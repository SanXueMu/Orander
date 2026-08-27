/**
 * product 域：分类 / SPU / 规格组（份量·温度·甜度·加料） / 标签 / 服务端计价
 * 旧 dishes 集合动作原样保留（R2 前端切到 getProductCatalog 后退役）
 */
const { col, generateId, nowIso } = require('../lib/context')

const mapDish = (doc = {}) => ({
  id: doc.id,
  name: doc.name || '',
  category: doc.category || '',
  price: Number(doc.price || 0),
  description: doc.description || '',
  image: doc.image || '',
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  featured: !!doc.featured,
  soldOut: !!doc.soldOut,
})

const sortDishes = (dishes) => {
  return [...dishes].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1
    }
    if (left.category !== right.category) {
      return String(left.category).localeCompare(String(right.category), 'zh-Hans-CN')
    }
    return String(left.name).localeCompare(String(right.name))
  })
}

const mapSpu = (doc = {}) => ({
  id: doc.id,
  name: doc.name || '',
  categoryId: doc.categoryId || '',
  basePrice: Number(doc.basePrice || 0),
  description: doc.description || '',
  images: Array.isArray(doc.images) ? doc.images : [],
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  soldCount: Number(doc.soldCount || 0),
  soldOut: !!doc.soldOut,
  specGroups: Array.isArray(doc.specGroups) ? doc.specGroups : [],
  available: doc.available !== false,
})

/**
 * 服务端计价（信任边界：金额一律以此为准）
 * items: [{ spuId, selections: [{groupId, optionId}], qty }]
 */
async function priceItems(items = []) {
  const results = []
  for (const item of items) {
    /* 百货商品通道：m:<mall_products.id>，无规格，直接按价 */
    if (item.spuId && String(item.spuId).indexOf('m:') === 0) {
      const mallResult = await col('mall_products').where({ id: String(item.spuId).slice(2) }).limit(1).get()
      const mallDoc = mallResult.data[0]
      if (!mallDoc || mallDoc.status !== 'ON') {
        throw new Error(`百货商品不存在或已下架: ${item.spuId}`)
      }
      const mallQty = Math.max(1, Math.min(99, Number(item.qty) || 1))
      results.push({
        spuId: item.spuId,
        name: mallDoc.name || '',
        image: mallDoc.image || '',
        qty: mallQty,
        unitPrice: Number(mallDoc.price || 0),
        subtotal: Number((Number(mallDoc.price || 0) * mallQty).toFixed(2)),
        selections: [],
      })
      continue
    }
    const spuResult = await col('spus').where({ id: item.spuId }).limit(1).get()
    if (spuResult.length === 0 && spuResult.data.length === 0) {
      throw new Error(`商品不存在: ${item.spuId}`)
    }
    const spu = mapSpu(spuResult.data[0])
    if (spu.soldOut || !spu.available) {
      throw new Error(`${spu.name} 已售罄`)
    }

    const qty = Math.max(1, Math.min(99, Number(item.qty) || 1))
    let unit = spu.basePrice
    const chosen = []

    ;(item.selections || []).forEach((selection) => {
      const group = spu.specGroups.find((g) => g.id === selection.groupId)
      if (!group) {
        return
      }
      const option = (group.options || []).find((o) => o.id === selection.optionId)
      if (!option) {
        return
      }
      if (group.single !== false) {
        group.options.forEach((o) => {
          if (o.id === option.id) {
            return
          }
          const other = chosen.find((c) => c.groupId === group.id && c.optionId === o.id)
          if (other) {
            chosen.splice(chosen.indexOf(other), 1)
            unit -= Number(o.price || 0)
          }
        })
      }
      if (!chosen.some((c) => c.groupId === group.id && c.optionId === option.id)) {
        unit += Number(option.price || 0)
        chosen.push({ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name })
      }
    })

    results.push({
      spuId: spu.id,
      name: spu.name,
      image: spu.images[0] || '',
      qty,
      unitPrice: Number(unit.toFixed(2)),
      subtotal: Number((unit * qty).toFixed(2)),
      selections: chosen,
    })
  }
  const total = Number(results.reduce((sum, r) => sum + r.subtotal, 0).toFixed(2))
  return { items: results, total }
}

module.exports = {
  priceItems,
  mapSpu,
  mapDish,

  async getProductCatalog() {
    const [categoryResult, spuResult] = await Promise.all([
      col('categories').orderBy('order', 'asc').limit(50).get(),
      col('spus').orderBy('soldCount', 'desc').limit(200).get(),
    ])
    return {
      categories: categoryResult.data,
      spus: spuResult.data.map(mapSpu),
    }
  },

  async searchProducts(event = {}) {
    const keyword = String(event.keyword || '').trim()
    if (!keyword) {
      return { items: [] }
    }
    const spuResult = await col('spus').limit(200).get()
    const items = spuResult.data
      .map(mapSpu)
      .filter((spu) => spu.name.includes(keyword) || spu.description.includes(keyword) || spu.tags.some((t) => t.includes(keyword)))
    return { items }
  },

  /* ---- SPU 管理（admin） ---- */
  async saveSpu(event = {}) {
    const next = { ...mapSpu(event.spu || {}), updatedAt: nowIso() }
    if (!next.id) {
      next.id = generateId('spu')
    }
    const current = await col('spus').where({ id: next.id }).limit(1).get()
    if (current.data.length) {
      await col('spus').where({ id: next.id }).update({ data: next })
    } else {
      await col('spus').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  async deleteSpu(event = {}) {
    await col('spus').where({ id: event.spuId }).remove()
    return { id: event.spuId }
  },

  async saveCategory(event = {}) {
    const next = {
      id: event.category && event.category.id ? event.category.id : generateId('cat'),
      name: (event.category && event.category.name) || '未命名',
      order: Number((event.category && event.category.order) || 0),
      updatedAt: nowIso(),
    }
    const current = await col('categories').where({ id: next.id }).limit(1).get()
    if (current.data.length) {
      await col('categories').where({ id: next.id }).update({ data: next })
    } else {
      await col('categories').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  /* ---- 旧 dishes 动作（原样兼容） ---- */
  async bootstrap(event = {}) {
    const dishes = event.dishes || []
    const existing = await col('dishes').limit(1).get()
    if (existing.data.length === 0 && dishes.length) {
      await Promise.all(
        dishes.map((dish) => col('dishes').add({
          data: { ...mapDish(dish), createdAt: nowIso(), updatedAt: nowIso() },
        })),
      )
    }
    const result = await col('dishes').limit(100).get()
    return sortDishes(result.data.map(mapDish))
  },

  async listDishes() {
    const result = await col('dishes').limit(100).get()
    return sortDishes(result.data.map(mapDish))
  },

  async saveDish(event = {}) {
    const nextDish = { ...mapDish(event.dish || {}), updatedAt: nowIso() }
    const current = await col('dishes').where({ id: nextDish.id }).limit(1).get()
    if (current.data.length) {
      await col('dishes').where({ id: nextDish.id }).update({ data: nextDish })
    } else {
      await col('dishes').add({ data: { ...nextDish, createdAt: nowIso() } })
    }
    return mapDish(nextDish)
  },

  async deleteDish(event = {}) {
    await col('dishes').where({ id: event.dishId }).remove()
    return { id: event.dishId }
  },
}
