import { fetchCloudDishes, initCloud } from '../../utils/cloud'
import {
  addToCart,
  formatMoney,
  getCart,
  getCartStats,
  getDishes,
  getDishCoverStyle,
  getMenuCategories,
  getSession,
  isVisitorSession,
  setCartQuantity,
} from '../../utils/orander'
import type { Dish } from '../../utils/orander'

type MenuDishView = Dish & {
  quantity: number
  coverStyle: string
}

const buildMenuDishes = (category: string) => {
  const cartMap = new Map(getCart().map((item) => [item.dishId, item.quantity]))

  return getDishes()
    .filter((dish) => category === '全部' || dish.category === category)
    .map((dish) => ({
      ...dish,
      quantity: cartMap.get(dish.id) || 0,
      coverStyle: getDishCoverStyle(dish.id),
    }))
}

Page({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#111111',
    navBackground: '#f4f4f4',
    nickname: '访客',
    categories: ['全部'],
    activeCategory: '全部',
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

    if (initCloud()) {
      await fetchCloudDishes()
    }

    this.refreshPage()
  },

  refreshPage() {
    const session = getSession()
    const categories = ['全部', ...getMenuCategories()]
    const activeCategory = categories.includes(this.data.activeCategory) ? this.data.activeCategory : '全部'
    const stats = getCartStats()

    this.setData({
      nickname: session ? session.nickname : '访客',
      categories,
      activeCategory,
      dishes: buildMenuDishes(activeCategory),
      cartCount: stats.count,
      cartTotalText: formatMoney(stats.total),
    })
  },

  switchCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    this.setData({
      activeCategory: category,
      dishes: buildMenuDishes(category),
    })
  },

  increaseDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
    const dish = getDishes().find((item) => item.id === dishId)
    if (!dish || dish.soldOut) {
      return
    }

    addToCart(dishId, 1)
    this.refreshPage()
  },

  decreaseDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
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
})
