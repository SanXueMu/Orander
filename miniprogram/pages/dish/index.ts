import { fetchCloudDishes, getBusinessStatusCloud, initCloud } from '../../utils/cloud'
import {
  addToCart,
  cleanSoldOutFromCart,
  formatMoney,
  getCart,
  getCartStats,
  getCurrentMember,
  getDishes,
  getDishCoverStyle,
  getLastCategory,
  getMenuCategories,
  getSession,
  isVisitorSession,
  saveLastCategory,
  setCartQuantity,
} from '../../utils/orander'
import type { Dish } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { eventBus } from '../../utils/event-bus'

type MenuDishView = Dish & {
  quantity: number
  coverStyle: string
  priceText: string
}

const resolveDishId = (event: WechatMiniprogram.BaseEvent) => {
  const detail = (event as WechatMiniprogram.CustomEvent).detail as { id?: string } | undefined
  return (detail && detail.id) || (event.currentTarget.dataset.id as string)
}

const buildMenuDishes = (category: string, keyword: string) => {
  const cartMap = new Map(getCart().map((item) => [item.dishId, item.quantity]))
  const search = keyword.trim().toLowerCase()

  return getDishes()
    .filter((dish) => category === '全部' || dish.category === category)
    .filter((dish) => !search || dish.name.toLowerCase().includes(search) || dish.description.toLowerCase().includes(search) || dish.tags.some((tag) => tag.toLowerCase().includes(search)))
    .map((dish) => ({
      ...dish,
      quantity: cartMap.get(dish.id) || 0,
      coverStyle: getDishCoverStyle(dish.id),
      priceText: formatMoney(dish.price),
    }))
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

  data: {
    nickname: '访客',
    menuLoading: true,
    greetingText: '你好',
    dateText: '',
    businessOpen: true,
    businessLoaded: false,
    categories: ['全部'],
    activeCategory: '全部',
    searchKeyword: '',
    dishes: [] as MenuDishView[],
    cartCount: 0,
    cartTotalText: formatMoney(0),
  },

  async onShow() {
    if (!isVisitorSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

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
        this.setData({ cartCount: payload.count })
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
    const activeCategory = categories.includes(this.data.activeCategory) && this.data.activeCategory !== '全部'
      ? this.data.activeCategory
      : categories.includes(remembered) ? remembered : '全部'
    const stats = getCartStats()

    this.setData({
      nickname: session ? session.nickname : '访客',
      categories,
      activeCategory,
      dishes: buildMenuDishes(activeCategory, this.data.searchKeyword),
      cartCount: stats.count,
      cartTotalText: formatMoney(stats.total),
    })
  },

  switchCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    saveLastCategory(category)
    this.setData({
      activeCategory: category,
      dishes: buildMenuDishes(category, this.data.searchKeyword),
    })
  },

  onSearchInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    const searchKeyword = detail.value || ''
    this.setData({
      searchKeyword,
      dishes: buildMenuDishes(this.data.activeCategory, searchKeyword),
    })
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      dishes: buildMenuDishes(this.data.activeCategory, ''),
    })
  },

  increaseDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = resolveDishId(event)
    const dish = getDishes().find((item) => item.id === dishId)
    if (!dish || dish.soldOut) {
      return
    }

    addToCart(dishId, 1)
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
})
