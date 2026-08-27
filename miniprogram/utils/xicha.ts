/**
 * 喜茶GO 复刻 · 数据层（R2）
 * 商品中台(分类/SPU/规格组)、门店、履约模式、购物车 v2（带规格快照）
 * 目录优先走云端；云端不可用时自动把旧菜品(orander.ts)转换为无规格 SPU，页面单渲染路径。
 */
import type { Dish } from './orander'
import { getDishes } from './orander'

/* ============ 类型 ============ */

export type FulfillMode = 'PICKUP' | 'DELIVERY'

export interface SpecOption {
  id: string
  name: string
  extraPrice: number
}

export interface SpecGroup {
  id: string
  name: string
  multiple: boolean
  options: SpecOption[]
}

export interface Spu {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description: string
  image: string
  basePrice: number
  tags: string[]
  soldOut: boolean
  soldCount: number
  featured: boolean
  specGroups: SpecGroup[]
}

export interface CatalogCategory {
  id: string
  name: string
}

export interface StoreInfo {
  id: string
  name: string
  address: string
  latitude?: number
  longitude?: number
}

export interface SelectionRef {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  extraPrice: number
}

/** 购物车 v2 行：自带快照，渲染不依赖目录在线 */
export interface CartLineV2 {
  key: string
  spuId: string
  name: string
  image: string
  basePrice: number
  quantity: number
  selections: SelectionRef[]
}

/* ============ 存储 ============ */

const KEYS = {
  catalog: 'xc-catalog',
  stores: 'xc-stores',
  storeId: 'xc-store-id',
  fulfill: 'xc-fulfill',
  cart: 'xc-cart-v2',
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const read = <T>(key: string, fallback: T): T => {
  const value = wx.getStorageSync(key)
  return value ? clone(value as T) : clone(fallback)
}

const write = <T>(key: string, value: T) => {
  wx.setStorageSync(key, clone(value))
}

/* ============ 目录（含旧数据降级） ============ */

let _catalogCache: { categories: CatalogCategory[]; spus: Spu[] } | null = null

export const saveCatalog = (catalog: { categories: CatalogCategory[]; spus: Spu[] }) => {
  const payload = {
    categories: catalog.categories || [],
    spus: (catalog.spus || []).map((spu) => ({
      ...spu,
      specGroups: spu.specGroups || [],
    })),
  }
  write(KEYS.catalog, payload)
  _catalogCache = payload
}

const legacyToSpu = (dish: Dish): Spu => {
  const slug = dish.category.replace(/\s+/g, '')
  return {
    id: `legacy:${dish.id}`,
    categoryId: `legacy-cat-${slug}`,
    categoryName: dish.category,
    name: dish.name,
    description: dish.description,
    image: dish.image,
    basePrice: dish.price,
    tags: dish.tags || [],
    soldOut: !!dish.soldOut,
    soldCount: 0,
    featured: !!dish.featured,
    specGroups: [],
  }
}

const legacyCatalog = () => {
  const dishes = getDishes()
  const seen = new Map<string, CatalogCategory>()
  dishes.forEach((dish) => {
    if (!seen.has(dish.category)) {
      seen.set(dish.category, { id: `legacy-cat-${dish.category.replace(/\s+/g, '')}`, name: dish.category })
    }
  })
  return {
    categories: Array.from(seen.values()),
    spus: dishes.map(legacyToSpu),
  }
}

export const getCatalog = (): { categories: CatalogCategory[]; spus: Spu[] } => {
  if (_catalogCache) {
    return clone(_catalogCache)
  }
  const stored = read<{ categories: CatalogCategory[]; spus: Spu[] } | null>(KEYS.catalog, null)
  if (stored && stored.spus && stored.spus.length > 0) {
    _catalogCache = stored
    return clone(stored)
  }
  return legacyCatalog()
}

export const invalidateCatalog = () => {
  _catalogCache = null
}

/* ============ 菜单分组（点单页右栏） ============ */

export interface MenuFlowGroup {
  key: string
  id: string
  name: string
  items: Spu[]
}

export const buildMenuGroups = (
  keyword: string,
): { groups: MenuFlowGroup[]; total: number } => {
  const search = keyword.trim().toLowerCase()
  const catalog = getCatalog()
  const matches = (spu: Spu) =>
    !search ||
    spu.name.toLowerCase().includes(search) ||
    spu.description.toLowerCase().includes(search) ||
    spu.tags.some((tag) => tag.toLowerCase().includes(search))

  if (search) {
    const items = catalog.spus.filter(matches)
    return {
      groups: [{ key: 'search', id: 'search', name: '搜索结果', items }],
      total: items.length,
    }
  }

  const groups = catalog.categories
    .map((category, index) => ({
      key: String(index),
      id: category.id,
      name: category.name,
      items: catalog.spus.filter((spu) => spu.categoryId === category.id && matches(spu)),
    }))
    .filter((group) => group.items.length > 0)

  /* 云端没有分类兜底：按 SPU 自带分类名聚合 */
  if (!groups.length) {
    const fallbackMap = new Map<string, MenuFlowGroup>()
    catalog.spus.filter(matches).forEach((spu) => {
      let group = fallbackMap.get(spu.categoryName)
      if (!group) {
        group = { key: `n-${fallbackMap.size}`, id: spu.categoryId, name: spu.categoryName, items: [] }
        fallbackMap.set(spu.categoryName, group)
      }
      group.items.push(spu)
    })
    const list = Array.from(fallbackMap.values())
    return { groups: list, total: list.reduce((sum, group) => sum + group.items.length, 0) }
  }

  return { groups, total: groups.reduce((sum, group) => sum + group.items.length, 0) }
}

export const getSpuById = (spuId: string) => {
  return getCatalog().spus.find((spu) => spu.id === spuId) || null
}

/* ============ 计价（本地展示用；下单以服务端为准） ============ */

export const priceUnit = (basePrice: number, selections: SelectionRef[]) => {
  const extra = selections.reduce((sum, ref) => sum + (Number(ref.extraPrice) || 0), 0)
  return Number((Number(basePrice) + extra).toFixed(2))
}

export const selectionsText = (selections: SelectionRef[]) => {
  return selections.map((ref) => ref.optionName).join('/')
}

/* ============ 门店 & 履约模式 ============ */

export const saveStores = (stores: StoreInfo[]) => {
  write(KEYS.stores, stores)
}

export const getStoresLocal = (): StoreInfo[] => {
  return read<StoreInfo[]>(KEYS.stores, [])
}

export const getSelectedStore = (): StoreInfo | null => {
  const storeId = wx.getStorageSync(KEYS.storeId) as string
  const stores = getStoresLocal()
  const matched = storeId ? stores.find((store) => store.id === storeId) : null
  return matched || stores[0] || null
}

export const setSelectedStoreById = (storeId: string) => {
  write(KEYS.storeId, storeId)
}

export const getFulfillMode = (): FulfillMode => {
  const mode = wx.getStorageSync(KEYS.fulfill) as FulfillMode
  return mode === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'
}

export const setFulfillMode = (mode: FulfillMode) => {
  write(KEYS.fulfill, mode)
}

/* ============ 购物车 v2 ============ */

const buildLineKey = (spuId: string, selections: SelectionRef[]) => {
  const optionIds = selections.map((ref) => ref.optionId).sort().join('-')
  return `${spuId}__${optionIds}`
}

export const addCartLineV2 = (line: Omit<CartLineV2, 'key'>) => {
  const cart = read<CartLineV2[]>(KEYS.cart, [])
  const key = buildLineKey(line.spuId, line.selections)
  const existing = cart.find((item) => item.key === key)
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + line.quantity)
  } else {
    cart.unshift({ ...line, key })
  }
  write(KEYS.cart, cart)
  emitCartChanged()
}

export const getCartLinesV2 = (): CartLineV2[] => {
  return read<CartLineV2[]>(KEYS.cart, [])
}

export const setCartLineQtyV2 = (key: string, quantity: number) => {
  let cart = read<CartLineV2[]>(KEYS.cart, [])
  cart = cart
    .map((item) => (item.key === key ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0)
  write(KEYS.cart, cart)
  emitCartChanged()
}

export const removeCartLineV2 = (key: string) => {
  const cart = read<CartLineV2[]>(KEYS.cart, []).filter((item) => item.key !== key)
  write(KEYS.cart, cart)
  emitCartChanged()
}

export const clearCartV2 = () => {
  write(KEYS.cart, [])
  emitCartChanged()
}

export const getCartStatsV2 = () => {
  const lines = getCartLinesV2()
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce(
    (sum, line) => sum + priceUnit(line.basePrice, line.selections) * line.quantity,
    0,
  )
  return { count, total: Number(total.toFixed(2)) }
}

export const clearSoldOutFromCartV2 = () => {
  const soldOutIds = new Set(getCatalog().spus.filter((spu) => spu.soldOut).map((spu) => spu.id))
  const cart = getCartLinesV2()
  const next = cart.filter((line) => !soldOutIds.has(line.spuId))
  if (next.length !== cart.length) {
    write(KEYS.cart, next)
    emitCartChanged()
    return cart.length - next.length
  }
  return 0
}

import { eventBus } from './event-bus'

const emitCartChanged = () => {
  const stats = getCartStatsV2()
  eventBus.emit('cart-changed', { count: stats.count })
}

export { formatMoney }

function formatMoney(amount: number) {
  return `¥${amount.toFixed(2)}`
}
