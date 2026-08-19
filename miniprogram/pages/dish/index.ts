import { fetchCloudDishes, getBusinessStatusCloud, initCloud } from '../../utils/cloud'
import {
  addToCart,
  cleanSoldOutFromCart,
  formatMoney,
  getCart,
  getCartStats,
  getCurrentMember,
  getDishCoverStyle,
  getDishes,
  getLastCategory,
  getMenuCategories,
  getOrders,
  getSession,
  saveLastCategory,
  setCartQuantity,
} from '../../utils/orander'
import type { Dish } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { eventBus } from '../../utils/event-bus'

type MenuDishView = Dish & {
  quantity: number
  coverStyle: string
  foodIcon: string
  priceText: string
  priceValue: string
  soldCount: number
}

const resolveDishId = (event: WechatMiniprogram.BaseEvent) => {
  const detail = (event as WechatMiniprogram.CustomEvent).detail as { id?: string } | undefined
  return (detail && detail.id) || (event.currentTarget.dataset.id as string)
}

const FOOD_ICON_RULES: Array<[string, string]> = [
  ['饮', 'cup'], ['茶', 'cup'], ['咖', 'cup'], ['酒', 'cup'], ['水', 'cup'], ['奶', 'cup'], ['汁', 'cup'], ['浆', 'cup'], ['甜品', 'cup'],
  ['面', 'bowl'], ['粉', 'bowl'], ['饭', 'bowl'], ['粥', 'bowl'], ['包', 'bowl'], ['饺', 'bowl'], ['汤', 'bowl'], ['锅', 'bowl'], ['主食', 'bowl'],
  ['凉', 'plate'], ['沙拉', 'plate'], ['卤', 'plate'], ['腌', 'plate'], ['素', 'plate'],
]

const classifyFoodIcon = (category: string) => {
  for (const [keyword, icon] of FOOD_ICON_RULES) {
    if (category.indexOf(keyword) >= 0) {
      return icon
    }
  }

  return 'bowl'
}

/* 本地订单统计每个菜品累计销量（"已售 N" 徽章） */
const buildSoldCountMap = () => {
  const map = new Map<string, number>()
  getOrders().forEach((order) => {
    if (order.status === 'cancelled') {
      return
    }
    order.items.forEach((item) => {
      map.set(item.dishId, (map.get(item.dishId) || 0) + item.quantity)
    })
  })
  return map
}

type MenuFlowGroup = {
  key: string
  name: string
  items: MenuDishView[]
}

const decorateDishes = (dishes: Dish[]) => {
  const cartMap = new Map(getCart().map((item) => [item.dishId, item.quantity]))
  const soldMap = buildSoldCountMap()
  return dishes.map((dish) => ({
    ...dish,
    quantity: cartMap.get(dish.id) || 0,
    coverStyle: getDishCoverStyle(dish.id),
    foodIcon: classifyFoodIcon(dish.category),
    priceText: formatMoney(dish.price),
    priceValue: String(dish.price),
    soldCount: soldMap.get(dish.id) || 0,
  }))
}

/* S2 左右分栏：搜索时空组分退化为「搜索结果」单组，平时按分类全量分组（锚点跳转而非过滤） */
const buildFlowState = (keyword: string) => {
  const search = keyword.trim().toLowerCase()
  const matches = (dish: Dish) => !search || dish.name.toLowerCase().includes(search) || dish.description.toLowerCase().includes(search) || dish.tags.some((tag) => tag.toLowerCase().includes(search))

  if (search) {
    const items = decorateDishes(getDishes().filter(matches))
    return { groups: [{ key: 'search', name: '搜索结果', items }] as MenuFlowGroup[], total: items.length }
  }

  const groups = getMenuCategories()
    .map((name, index) => ({ key: String(index), name, items: decorateDishes(getDishes().filter((dish) => dish.category === name && matches(dish))) }))
    .filter((group) => group.items.length > 0)
  return { groups, total: groups.reduce((sum, group) => sum + group.items.length, 0) }
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const buildGreeting = () => {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`
  return { greetingText: greeting, dateText }
}

Page({
  behaviors: [pageLookBehavior],

  cartChangedHandler: null as ((payload: { count: number }) => void) | null,

  orderCreatedHandler: null as (() => void) | null,

  /* S2 滚动同步：右侧滚动位置 → 左侧分类高亮 */
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
    categories: ['全部'],
    railActive: '全部',
    searchKeyword: '',
    flowGroups: [] as MenuFlowGroup[],
    flowTotal: 0,
    flowInto: '',
    flowTop: 0,
    cartCount: 0,
    countBounce: false,
    cartTotalText: formatMoney(0),
    loadedImages: {} as Record<string, boolean>,
  },

  async onShow() {
    /* 游客模式：未登录也可自由浏览菜单（审核要求先体验后授权），结算时才引导登录 */
    this.setData(buildGreeting())

    if (initCloud()) {
      this.setData({ menuLoading: true })
      await fetchCloudDishes()

      getBusinessStatusCloud().then((status) => {
        if (status) {
          this.setData({ businessOpen: status.open, businessLoaded: true })
        }
      })
    }

    const removed = cleanSoldOutFromCart()
    if (removed > 0) {
      wx.showToast({
        title: `已清理 ${removed} 件售罄菜品`,
        icon: 'none',
      })
    }

    this.refreshPage()
    this.setData({ menuLoading: false })

    if (!this.cartChangedHandler) {
      this.cartChangedHandler = (payload) => {
        this.setData({ cartCount: payload.count, countBounce: true })
        setTimeout(() => {
          this.setData({ countBounce: false })
        }, 420)
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

  refreshPage() {
    const session = getSession()
    applyPageLook(this, getCurrentMember())
    const categories = ['全部', ...getMenuCategories()]
    const remembered = getLastCategory()
    const railActive = categories.includes(this.data.railActive) && this.data.railActive !== '全部'
      ? this.data.railActive
      : categories.includes(remembered) && remembered !== '全部' ? remembered : '全部'
    const stats = getCartStats()
    const flow = buildFlowState(this.data.searchKeyword)

    this.setData({
      nickname: session ? session.nickname : '访客',
      categories,
      railActive,
      flowGroups: flow.groups,
      flowTotal: flow.total,
      cartCount: stats.count,
      cartTotalText: formatMoney(stats.total),
    })
    this.scheduleAnchorWork()
  },

  /* 数据/渲染就绪后：量锚点位置 + 首次按记忆分类定位 */
  scheduleAnchorWork() {
    wx.nextTick(() => {
      this.measureAnchors()
      if (!this._didInitialAnchor) {
        this._didInitialAnchor = true
        const remembered = this.data.railActive
        if (remembered !== '全部') {
          const group = this.data.flowGroups.find((item) => item.name === remembered)
          if (group) {
            this.setData({ flowInto: `anchor-${group.key}` })
          }
        }
      }
    })
  },

  measureAnchors() {
    const query = this.createSelectorQuery()
    query.selectAll('.flow-cat-anchor').boundingClientRect()
    query.select('.menu-flow').boundingClientRect()
    query.exec((rects) => {
      const anchors = (rects[0] || []) as WechatMiniprogram.BoundingClientRectResult[]
      const flow = rects[1] as WechatMiniprogram.BoundingClientRectResult | null
      if (!flow || !anchors.length) {
        return
      }
      this._anchorOffsets = anchors.map((rect) => ({
        top: rect.top - flow.top + this._flowScrollTop,
        name: '',
      }))
      this._anchorOffsets.forEach((offset, index) => {
        const group = this.data.flowGroups[index]
        if (group) {
          offset.name = group.name
        }
      })
    })
  },

  /* 点左侧分类 → 右侧锚点滚动（不做过滤，茶饮菜单范式） */
  tapRailCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    saveLastCategory(category)
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
    const searchKeyword = detail.value || ''
    const flow = buildFlowState(searchKeyword)
    this.setData({
      searchKeyword,
      flowGroups: flow.groups,
      flowTotal: flow.total,
      railActive: '全部',
      flowInto: '',
    })
    this.scheduleAnchorWork()
  },

  clearSearch() {
    const flow = buildFlowState('')
    this.setData({
      searchKeyword: '',
      flowGroups: flow.groups,
      flowTotal: flow.total,
      railActive: '全部',
      flowInto: '',
    })
    this.scheduleAnchorWork()
  },

  /* 图片 bindload 淡入：只更新 loadedImages 小对象，不动 dishes 数组 */
  onDishImageLoad(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
    if (!dishId || this.data.loadedImages[dishId]) {
      return
    }

    this.setData({
      [`loadedImages.${dishId}`]: true,
    })
  },

  increaseDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = resolveDishId(event)
    const dish = getDishes().find((item) => item.id === dishId)
    if (!dish || dish.soldOut) {
      return
    }

    addToCart(dishId, 1)
    wx.vibrateShort({ type: 'light' })
    this.refreshPage()
  },

  decreaseDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = resolveDishId(event)
    const cartLine = getCart().find((item) => item.dishId === dishId)
    if (!cartLine) {
      return
    }

    setCartQuantity(dishId, cartLine.quantity - 1)
    this.refreshPage()
  },

  goBill() {
    wx.navigateTo({
      url: '/pages/cart/index',
    })
  },

  goOrders() {
    wx.redirectTo({
      url: '/pages/orders/index',
    })
  },

  tapSettle() {
    if (this.data.businessLoaded && !this.data.businessOpen) {
      wx.showToast({
        title: '今日暂停营业，暂不能下单',
        icon: 'none',
      })
      return
    }

    if (!getSession()) {
      wx.showModal({
        title: '登录后下单',
        content: '浏览菜单无需登录，提交订单需要先登录身份。',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/index/index' })
          }
        },
      })
      return
    }

    this.goBill()
  },
})
