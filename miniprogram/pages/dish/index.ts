import { fetchCloudDishes, initCloud } from '../../utils/cloud'
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

type MenuDishView = Dish & {
  quantity: number
  coverStyle: string
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
    }))
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '访客',
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

    if (initCloud()) {
      await fetchCloudDishes()
    }

    const removed = cleanSoldOutFromCart()
    if (removed > 0) {
      wx.showToast({
        title: `已清理 ${removed} 件售罄菜品`,
        icon: 'none',
      })
    }

    this.refreshPage()
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
