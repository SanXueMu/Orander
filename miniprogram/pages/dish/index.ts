import { fetchCatalogCloud, fetchStoresCloud, getBusinessStatusCloud, initCloud, getBannersCloud } from '../../utils/cloud'
import {
  applyPageLook,
  pageLookBehavior,
} from '../../behaviors/page-look'
import { eventBus } from '../../utils/event-bus'
import {
  addCartLineV2,
  buildMenuGroups,
  clearSoldOutFromCartV2,
  getCartLinesV2,
  getCartStatsV2,
  getSelectedStore,
  getStoresLocal,
  getFulfillMode,
  setCartLineQtyV2,
  setFulfillMode,
  saveCatalog,
  saveStores,
  setSelectedStoreById,
  type CartLineV2,
  type FulfillMode,
  type Spu,
  type StoreInfo,
} from '../../utils/xicha'
import { formatMoney, getCurrentMember, getSession } from '../../utils/orander'

type MenuSpuView = Spu & {
  quantity: number
  specQuantity: number
  coverStyle: string
  foodIcon: string
  hasSpecs: boolean
  priceValue: string
}

type MenuFlowGroupView = {
  key: string
  id: string
  name: string
  items: MenuSpuView[]
}

const FOOD_ICON_RULES: Array<[string, string]> = [
  ['饮', 'cup'], ['茶', 'cup'], ['咖', 'cup'], ['酒', 'cup'], ['水', 'cup'], ['奶', 'cup'], ['汁', 'cup'], ['浆', 'cup'],
  ['面', 'bowl'], ['粉', 'bowl'], ['饭', 'bowl'], ['粥', 'bowl'], ['汤', 'bowl'],
  ['凉', 'plate'], ['沙', 'plate'], ['卤', 'plate'],
]

const classifyFoodIcon = (category: string) => {
  for (const [keyword, icon] of FOOD_ICON_RULES) {
    if (category.indexOf(keyword) >= 0) {
      return icon
    }
  }
  return 'bowl'
}

/* 深色底插画 fallback（与旧版同风格） */
const COVER_BACKGROUNDS = [
  'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
  'linear-gradient(135deg, #2a2a2a 0%, #6a6a6a 100%)',
  'linear-gradient(135deg, #050505 0%, #585858 100%)',
  'linear-gradient(135deg, #202020 0%, #8b8b8b 100%)',
]

const hashString = (value: string) => {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

const getDishCoverStyle = (seed: string) => {
  return `background:${COVER_BACKGROUNDS[hashString(seed || 'spu') % COVER_BACKGROUNDS.length]};`
}

const decorateSpus = (): { groups: MenuFlowGroupView[]; total: number } => {
  const keyword = ''
  const flow = buildMenuGroups(keyword)
  const lines = getCartLinesV2()
  const qtyBySpu = new Map<string, number>()
  lines.forEach((line) => {
    qtyBySpu.set(line.spuId, (qtyBySpu.get(line.spuId) || 0) + line.quantity)
  })

  const groups = flow.groups.map((group) => ({
    key: group.key,
    id: group.id,
    name: group.name,
    items: group.items.map((spu) => ({
      ...spu,
      quantity: 0,
      specQuantity: qtyBySpu.get(spu.id) || 0,
      coverStyle: getDishCoverStyle(spu.id),
      foodIcon: classifyFoodIcon(spu.categoryName),
      hasSpecs: !!(spu.specGroups && spu.specGroups.length > 0),
      priceValue: String(spu.basePrice),
    })),
  }))
  return { groups, total: flow.total }
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

Page({
  behaviors: [pageLookBehavior],

  cartChangedHandler: null as ((payload: { count: number }) => void) | null,

  orderCreatedHandler: null as (() => void) | null,

  _flowScrollTop: 0,
  _anchorOffsets: [] as Array<{ top: number; name: string }>,
  _lastScrollSync: 0,
  _didInitialAnchor: false,

  data: {
    nickname: '访客',
    menuLoading: true,
    greetingText: '你好',
    dateText: '',
    businessOpen: true,
    businessLoaded: false,
    banners: [] as Array<{ id: string; title?: string; image?: string; link?: string }>,
    /* 地址栏 */
    fulfillMode: 'PICKUP' as FulfillMode,
    store: null as StoreInfo | null,
    storeSheetVisible: false,
    stores: [] as StoreInfo[],
    /* 菜单 */
    categories: ['全部'] as string[],
    railActive: '全部',
    searchKeyword: '',
    flowGroups: [] as MenuFlowGroupView[],
    flowTotal: 0,
    flowInto: '',
    flowTop: 0,
    /* 规格弹窗 */
    pickerVisible: false,
    pickerSpu: null as Spu | null,
    /* 结算 */
    cartCount: 0,
    countBounce: false,
    cartTotalText: formatMoney(0),
    loadedImages: {} as Record<string, boolean>,
  },

  async onShow() {
    this.setData({
      greetingText: (() => {
        const hour = new Date().getHours()
        return hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
      })(),
      dateText: (() => {
        const now = new Date()
        return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`
      })(),
      fulfillMode: getFulfillMode(),
      store: getSelectedStore(),
      stores: getStoresLocal(),
    })

    if (initCloud()) {
      this.setData({ menuLoading: true })
      getBannersCloud('dish').then((result) => {
        const items = ((result && result.items) || []) as typeof this.data.banners
        this.setData({ banners: items.filter((item) => item.image || item.title) })
      }).catch(() => null)
      const catalog = await fetchCatalogCloud()
      if (catalog && catalog.spus && catalog.spus.length > 0) {
        saveCatalog(catalog)
      }
      fetchStoresCloud().then((result) => {
        if (result && result.stores && result.stores.length > 0) {
          saveStores(result.stores)
          this.setData({ stores: result.stores })
          if (!this.data.store) {
            this.setData({ store: getSelectedStore() })
          }
        }
      })

      getBusinessStatusCloud().then((status) => {
        if (status) {
          this.setData({ businessOpen: status.open, businessLoaded: true })
        }
      })
    }

    const removed = clearSoldOutFromCartV2()
    if (removed > 0) {
      wx.showToast({ title: `已清理 ${removed} 件售罄商品`, icon: 'none' })
    }

    this.refreshPage()
    this.setData({ menuLoading: false })

    if (!this.cartChangedHandler) {
      this.cartChangedHandler = (payload) => {
        this.setData({ cartCount: payload.count, countBounce: true })
        setTimeout(() => {
          this.setData({ countBounce: false })
        }, 420)
        this.decorateOnly()
      }
      this.orderCreatedHandler = () => {
        this.setData({ cartCount: 0 })
      }
      eventBus.on('cart-changed', this.cartChangedHandler)
      eventBus.on('order-created', this.orderCreatedHandler)
    }
  },

  onHide() {
    if (this.cartChangedHandler) {
      eventBus.off('cart-changed', this.cartChangedHandler)
      this.cartChangedHandler = null
    }
    if (this.orderCreatedHandler) {
      eventBus.off('order-created', this.orderCreatedHandler)
      this.orderCreatedHandler = null
    }
  },

  /* 只刷新数量徽标与锚点（避免整体 setData 抖动） */
  decorateOnly() {
    const next = decorateSpus()
    this.setData({
      flowGroups: next.groups,
      flowTotal: next.total,
      cartTotalText: formatMoney(getCartStatsV2().total),
    })
    wx.nextTick(() => this.measureAnchors())
  },

  refreshPage() {
    const session = getSession()
    applyPageLook(this, getCurrentMember())
    this.setData({ navColor: '#ffffff', navBackground: '#333333' })
    const flow = decorateSpus()
    const categories = ['全部', ...flow.groups.map((group) => group.name)]
    this.setData({
      nickname: session ? session.nickname : '访客',
      categories,
      railActive: categories.includes(this.data.railActive) ? this.data.railActive : '全部',
      flowGroups: flow.groups,
      flowTotal: flow.total,
      cartCount: getCartStatsV2().count,
      cartTotalText: formatMoney(getCartStatsV2().total),
    })
    this.scheduleAnchorWork()
  },

  scheduleAnchorWork() {
    wx.nextTick(() => {
      this.measureAnchors()
      if (!this._didInitialAnchor) {
        this._didInitialAnchor = true
      }
    })
  },

  measureAnchors() {
    const query = this.createSelectorQuery()
    query.selectAll('.flow-cat-anchor').boundingClientRect()
    query.select('.menu-flow').boundingClientRect()
    query.exec((rects) => {
      const anchors = (rects[0] || []) as WechatMiniprogram.BoundingClientRectResult[]
      const flowRect = rects[1] as WechatMiniprogram.BoundingClientRectResult | null
      if (!flowRect || !anchors.length) {
        return
      }
      this._anchorOffsets = anchors.map((rect, index) => ({
        top: rect.top - flowRect.top + this._flowScrollTop,
        name: this.data.flowGroups[index] ? this.data.flowGroups[index].name : '',
      }))
    })
  },

  tapRailCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    if (category === '全部') {
      this.setData({
        railActive: category,
        flowInto: '',
        flowTop: this._flowScrollTop > 0 ? 0 : 0.1,
      })
      return
    }
    const group = this.data.flowGroups.find((item) => item.name === category)
    this.setData({
      railActive: category,
      flowInto: group ? `anchor-${group.key}` : '',
    })
  },

  onFlowScroll(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { scrollTop: number }
    this._flowScrollTop = detail.scrollTop || 0
    const now = Date.now()
    if (now - this._lastScrollSync < 160 || !this._anchorOffsets.length) {
      return
    }
    this._lastScrollSync = now
    let active = '全部'
    for (let i = this._anchorOffsets.length - 1; i >= 0; i -= 1) {
      if (this._anchorOffsets[i].top <= this._flowScrollTop + 140) {
        active = this._anchorOffsets[i].name
        break
      }
    }
    if (active && active !== this.data.railActive) {
      this.setData({ railActive: active })
    }
  },

  onSearchInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.applySearch(detail.value || '')
  },

  applySearch(keyword: string) {
    const flow = buildMenuGroups(keyword)
    const lines = getCartLinesV2()
    const qtyBySpu = new Map<string, number>()
    lines.forEach((line) => qtyBySpu.set(line.spuId, (qtyBySpu.get(line.spuId) || 0) + line.quantity))
    this.setData({
      searchKeyword: keyword,
      flowGroups: flow.groups.map((group) => ({
        key: group.key,
        id: group.id,
        name: group.name,
        items: group.items.map((spu) => ({
          ...spu,
          quantity: 0,
          specQuantity: qtyBySpu.get(spu.id) || 0,
          coverStyle: getDishCoverStyle(spu.id),
          foodIcon: classifyFoodIcon(spu.categoryName),
          hasSpecs: !!(spu.specGroups && spu.specGroups.length > 0),
          priceValue: String(spu.basePrice),
        })),
      })),
      flowTotal: flow.total,
      railActive: '全部',
      flowInto: '',
    })
    wx.nextTick(() => this.measureAnchors())
  },

  clearSearch() {
    this.applySearch('')
  },

  onDishImageLoad(event: WechatMiniprogram.BaseEvent) {
    const spuId = event.currentTarget.dataset.id as string
    if (!spuId || this.data.loadedImages[spuId]) {
      return
    }
    this.setData({ [`loadedImages.${spuId}`]: true })
  },

  /* ===== 地址栏：履约模式 + 门店 ===== */

  switchMode(event: WechatMiniprogram.BaseEvent) {
    const mode = event.currentTarget.dataset.mode as FulfillMode
    setFulfillMode(mode)
    this.setData({ fulfillMode: mode })
    wx.vibrateShort({ type: 'light' })
  },

  onBannerTap(event: WechatMiniprogram.TouchEvent) {
    const link = String(event.currentTarget.dataset.link || '')
    if (link && link.startsWith('/pages/')) {
      wx.navigateTo({ url: link })
    }
  },

  openStoreSheet() {
    const stores = getStoresLocal()
    if (!stores.length) {
      wx.showToast({ title: '门店列表加载中', icon: 'none' })
      if (initCloud()) {
        fetchStoresCloud().then((result) => {
          if (result && result.stores && result.stores.length) {
            saveStores(result.stores)
            this.setData({ stores: result.stores, storeSheetVisible: true })
          }
        })
      }
      return
    }
    this.setData({ storeSheetVisible: true })
  },

  closeStoreSheet() {
    this.setData({ storeSheetVisible: false })
  },

  noop() {},

  selectStore(event: WechatMiniprogram.BaseEvent) {
    const storeId = event.currentTarget.dataset.id as string
    setSelectedStoreById(storeId)
    this.setData({ store: getSelectedStore(), storeSheetVisible: false })
    wx.vibrateShort({ type: 'light' })
  },

  /* ===== 无规格直接加减 ===== */

  findPlainLine(spuId: string): CartLineV2 | null {
    return getCartLinesV2().find((line) => line.spuId === spuId && line.selections.length === 0) || null
  },

  increaseSpu(event: WechatMiniprogram.BaseEvent) {
    const spuId = event.currentTarget.dataset.id as string
    const groups = this.data.flowGroups
    let target: Spu | null = null
    groups.forEach((group) => {
      const found = group.items.find((item) => item.id === spuId)
      if (found) {
        target = found
      }
    })
    if (!target || (target as Spu).soldOut) {
      return
    }

    const spu = target as Spu
    addCartLineV2({
      spuId: spu.id,
      name: spu.name,
      image: spu.image,
      basePrice: spu.basePrice,
      quantity: 1,
      selections: [],
    })
    wx.vibrateShort({ type: 'light' })
  },

  decreaseSpu(event: WechatMiniprogram.BaseEvent) {
    const spuId = event.currentTarget.dataset.id as string
    const line = this.findPlainLine(spuId)
    if (!line) {
      return
    }
    setCartLineQtyV2(line.key, line.quantity - 1)
  },

  /* ===== 规格弹窗 ===== */

  openSpecPicker(event: WechatMiniprogram.BaseEvent) {
    const spuId = event.currentTarget.dataset.id as string
    let target: Spu | null = null
    this.data.flowGroups.forEach((group) => {
      const found = group.items.find((item) => item.id === spuId)
      if (found) {
        target = found
      }
    })
    if (!target) {
      return
    }
    this.setData({ pickerVisible: true, pickerSpu: target })
  },

  onPickerClose() {
    this.setData({ pickerVisible: false })
  },

  onPickerAdd(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { line: Omit<CartLineV2, 'key'> }
    if (detail && detail.line) {
      addCartLineV2(detail.line)
      wx.showToast({ title: '已加入购物车', icon: 'none' })
    }
  },

  goBill() {
    wx.navigateTo({ url: '/pages/cart/index' })
  },

  goOrders() {
    wx.redirectTo({ url: '/pages/orders/index' })
  },

  tapSettle() {
    if (this.data.businessLoaded && !this.data.businessOpen) {
      wx.showToast({ title: '暂停营业中，暂不能下单', icon: 'none' })
      return
    }

    if (!getSession()) {
      wx.showModal({
        title: '登录后下单',
        content: '浏览菜单无需登录，提交订单需要先登录身份。',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile-edit/index' })
          }
        },
      })
      return
    }

    this.goBill()
  },
})
