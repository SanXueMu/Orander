import { deleteMemberCloud, fetchCloudDishes, fetchCloudMembers, initCloud, publishLocalDishesToCloud } from '../../utils/cloud'
import {
  clearCart,
  clearSession,
  deleteMember,
  deleteDish,
  formatMoney,
  formatShortDate,
  getAvatarStyle,
  getAdminToken,
  getContactCards,
  getDishCoverStyle,
  getDishes,
  getMenuCategories,
  getMonogram,
  getSession,
  isAdminSession,
  updateDishAvailability,
} from '../../utils/orander'

const mapDishCards = (activeCategory: string) => {
    return getDishes()
      .filter((dish) => activeCategory === '全部' || dish.category === activeCategory)
      .map((dish) => ({
        ...dish,
        priceText: formatMoney(dish.price),
        soldOutLabel: dish.soldOut ? '已售罄' : '供应中',
        availableChecked: !dish.soldOut,
        coverStyle: getDishCoverStyle(dish.id),
        imageLabel: getMonogram(dish.name, 'DI'),
      }))
}

Page({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#111111',
    navBackground: '#f4f4f4',
    adminName: 'Admin',
    activePanel: 'menu',
    categories: ['全部'],
    activeCategory: '全部',
    dishes: [] as Array<Record<string, unknown>>,
    members: [] as Array<Record<string, unknown>>,
    swipedDishId: '',
    touchStartX: 0,
    touchStartY: 0,
    publishingCloud: false,
  },

  async onShow() {
    if (!isAdminSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    await this.refreshPage(true)
  },

  async refreshPage(syncRemote = false) {
    const session = getSession()

    if (syncRemote && initCloud()) {
      await Promise.all([
        fetchCloudDishes(),
        fetchCloudMembers(),
      ])
    }

    const categories = ['全部', ...getMenuCategories()]
    const activeCategory = categories.indexOf(this.data.activeCategory) >= 0 ? this.data.activeCategory : '全部'
    const members = getContactCards().map((member) => ({
      ...member,
      showAvatarImage: !!member.avatarUrl,
      avatarLabel: getMonogram(member.nickname, 'OR'),
      avatarStyle: getAvatarStyle(member.nickname),
      joinedText: formatShortDate(member.joinedAt),
      lastOrderText: formatShortDate(member.lastOrderAt),
    }))

    this.setData({
      adminName: session ? session.nickname : 'Admin',
      categories,
      activeCategory,
      members,
      dishes: mapDishCards(activeCategory),
    })
  },

  switchPanel(event: WechatMiniprogram.BaseEvent) {
    const panel = event.currentTarget.dataset.panel as string
    this.setData({
      activePanel: panel,
    })
  },

  switchCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    this.setData({
      activeCategory: category,
      dishes: mapDishCards(category),
      swipedDishId: '',
    })
  },

  onDishTouchStart(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches[0]
    this.setData({
      touchStartX: touch ? touch.clientX : 0,
      touchStartY: touch ? touch.clientY : 0,
    })
  },

  onDishTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches[0]
    const endX = touch ? touch.clientX : 0
    const endY = touch ? touch.clientY : 0
    const deltaX = endX - this.data.touchStartX
    const deltaY = endY - this.data.touchStartY
    const dishId = event.currentTarget.dataset.id as string

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    if (deltaX < -36) {
      this.setData({
        swipedDishId: dishId,
      })
      return
    }

    if (deltaX > 20 || this.data.swipedDishId === dishId) {
      this.setData({
        swipedDishId: '',
      })
    }
  },

  closeSwipe() {
    if (!this.data.swipedDishId) {
      return
    }

    this.setData({
      swipedDishId: '',
    })
  },

  goCreateDish() {
    const category = this.data.activeCategory === '全部' ? '' : this.data.activeCategory
    const query = category ? `?category=${encodeURIComponent(category)}` : ''

    wx.navigateTo({
      url: `/pages/admin-dish/index${query}`,
    })
  },

  publishMenuToCloud() {
    if (this.data.publishingCloud) {
      return
    }

    wx.showModal({
      title: '发布到云端',
      content: '将把当前本地菜品新增或更新到云端，不会删除现有用户、订单和其他云端菜品。是否继续？',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        if (!initCloud(true)) {
          wx.showToast({
            title: '云开发未就绪',
            icon: 'none',
          })
          return
        }

        this.setData({ publishingCloud: true })
        wx.showLoading({ title: '发布中' })

        try {
          const dishes = await publishLocalDishesToCloud(getAdminToken())
          if (!dishes) {
            wx.showToast({
              title: '发布失败',
              icon: 'none',
            })
            return
          }

          await this.refreshPage(true)
          wx.showToast({
            title: `已发布${dishes.length}项`,
            icon: 'success',
          })
        } finally {
          wx.hideLoading()
          this.setData({ publishingCloud: false })
        }
      },
    })
  },

  goEditDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
    this.setData({ swipedDishId: '' })
    wx.navigateTo({
      url: `/pages/admin-dish/index?id=${dishId}`,
    })
  },

  async toggleDishAvailability(event: WechatMiniprogram.CustomEvent) {
    const dishId = event.currentTarget.dataset.id as string
    const detail = event.detail as { value?: boolean }

    updateDishAvailability(dishId, !detail.value)
    await this.refreshPage()
  },

  removeDish(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
    this.setData({ swipedDishId: '' })
    wx.showModal({
      title: '删除菜品',
      content: '确定删除当前菜品吗？',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        deleteDish(dishId)
        await this.refreshPage()
        wx.showToast({
          title: '已删除',
          icon: 'success',
        })
      },
    })
  },

  goUserOrders(event: WechatMiniprogram.BaseEvent) {
    const memberId = event.currentTarget.dataset.id as string
    wx.navigateTo({
      url: `/pages/admin-user/index?id=${memberId}`,
    })
  },

  removeMemberRecord(event: WechatMiniprogram.BaseEvent) {
    const memberId = event.currentTarget.dataset.id as string
    wx.showModal({
      title: '删除用户',
      content: '将清除该用户及其订单记录，是否继续？',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        deleteMember(memberId)
        if (initCloud()) {
          await deleteMemberCloud(memberId, getAdminToken())
          await fetchCloudMembers()
        }

        await this.refreshPage()
        wx.showToast({
          title: '已删除',
          icon: 'success',
        })
      },
    })
  },

  logout() {
    clearCart()
    clearSession(false)
    wx.reLaunch({
      url: '/pages/index/index',
    })
  },
})
