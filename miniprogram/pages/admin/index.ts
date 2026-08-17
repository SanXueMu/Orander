import {
  deleteMemberCloud,
  fetchCloudDishes,
  fetchCloudMembers,
  getBusinessStatusCloud,
  getOrderStatsCloud,
  initCloud,
  listAllOrdersCloud,
  publishLocalDishesToCloud,
  setBusinessStatusCloud,
  changeAdminPasswordCloud,
  getLastCloudError,
  verifyAdminCloud,
} from '../../utils/cloud'
import type { OrderStats, PaginatedOrders } from '../../utils/cloud'
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
  getOrders,
  getSession,
  isAdminSession,
  updateAdminToken,
  updateDishAvailability,
} from '../../utils/orander'
import type { Order } from '../../utils/orander'
import { pageLookBehavior } from '../../behaviors/page-look'

const ORDER_PAGE_SIZE = 15

const buildTodayFromOrders = (orders: Order[]) => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayOrders = orders.filter((order) => new Date(order.createdAt) >= startOfToday)

  return {
    orders: todayOrders.length,
    revenue: Number(todayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
    submitted: todayOrders.filter((order) => order.status === 'submitted').length,
  }
}

const buildDailyFromOrders = (orders: Order[]) => {
  const daily: Array<{ date: string; orders: number; revenue: number }> = []

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - offset)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)

    const dayOrders = orders.filter((order) => {
      const time = new Date(order.createdAt)
      return time >= day && time < next
    })

    daily.push({
      date: `${day.getMonth() + 1}/${day.getDate()}`,
      orders: dayOrders.length,
      revenue: Number(dayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
    })
  }

  return daily
}

const mapMemberCards = () => {
  return getContactCards().map((member) => ({
    ...member,
    showAvatarImage: !!member.avatarUrl,
    avatarLabel: getMonogram(member.nickname, 'OR'),
    avatarStyle: getAvatarStyle(member.nickname),
    joinedText: formatShortDate(member.joinedAt),
    lastOrderText: formatShortDate(member.lastOrderAt),
  }))
}

const mapOrderRows = (orders: Order[]) => {
  return orders.map((order) => ({
    ...order,
    totalText: formatMoney(order.total),
    createdText: formatShortDate(order.createdAt),
    statusText: order.status === 'completed' ? '已完成' : '已提交',
    previewText: order.items.slice(0, 3).map((item) => item.name).join(' · '),
    canComplete: order.status !== 'completed',
  }))
}

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
  behaviors: [pageLookBehavior],

  data: {
    adminName: 'Admin',
    activePanel: 'menu',
    categories: ['全部'],
    activeCategory: '全部',
    dishes: [] as Array<ReturnType<typeof mapDishCards>[number]>,
    members: [] as Array<ReturnType<typeof mapMemberCards>[number]>,
    swipedDishId: '',
    touchStartX: 0,
    touchStartY: 0,
    publishingCloud: false,
    orders: [] as Array<ReturnType<typeof mapOrderRows>[number]>,
    ordersPage: 1,
    ordersPageSize: ORDER_PAGE_SIZE,
    ordersTotal: 0,
    ordersLoading: false,
    statsRevenueText: formatMoney(0),
    stats: null as OrderStats | null,
    businessOpen: true,
    businessSyncing: false,
    chefName: '',
    chefEditing: false,
    chefInput: '',
    pwdEditing: false,
    pwdOld: '',
    pwdNew: '',
    pwdConfirm: '',
    pwdSubmitting: false,
  },

  async onShow() {
    if (!isAdminSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    await this.refreshPage(true)

    if (initCloud()) {
      const status = await getBusinessStatusCloud()
      if (status) {
        this.setData({ businessOpen: status.open, chefName: status.chefName || '' })
      }
    }
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
    const members = mapMemberCards()

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
      swipedDishId: '',
    })

    if (panel === 'orders') {
      this.loadOrders(1)
    } else if (panel === 'stats') {
      this.loadStats()
    }
  },

  async loadOrders(page: number) {
    if (!initCloud()) {
      this.loadLocalOrders(page)
      return
    }

    this.setData({ ordersLoading: true })
    try {
      const result = await listAllOrdersCloud(page, ORDER_PAGE_SIZE)
      if (!result) {
        this.setData({ cloudDegraded: true })
        this.loadLocalOrders(page)
        return
      }

      this.setData({ cloudDegraded: false })
      this.applyOrders(result)
    } finally {
      this.setData({ ordersLoading: false })
    }
  },

  loadLocalOrders(page: number) {
    const allOrders = getOrders()
    const total = allOrders.length
    const start = (page - 1) * ORDER_PAGE_SIZE
    const items = allOrders.slice(start, start + ORDER_PAGE_SIZE)

    this.setData({
      orders: mapOrderRows(items),
      ordersPage: page,
      ordersTotal: total,
    })
  },

  applyOrders(result: PaginatedOrders) {
    this.setData({
      orders: mapOrderRows(result.items),
      ordersPage: result.page,
      ordersTotal: result.total,
    })
  },

  prevOrdersPage() {
    if (this.data.ordersPage <= 1) {
      return
    }
    this.loadOrders(this.data.ordersPage - 1)
  },

  nextOrdersPage() {
    const maxPage = Math.max(1, Math.ceil(this.data.ordersTotal / ORDER_PAGE_SIZE))
    if (this.data.ordersPage >= maxPage) {
      return
    }
    this.loadOrders(this.data.ordersPage + 1)
  },

  async completeOrder(event: WechatMiniprogram.BaseEvent) {
    const orderId = event.currentTarget.dataset.id as string
    const order = this.data.orders.find((item) => (item as { id: string }).id === orderId) as Order | undefined
    if (!order || order.status === 'completed') {
      return
    }

    wx.vibrateShort({ type: 'light' })

    if (initCloud()) {
      const { updateCloudOrderStatus } = await import('../../utils/cloud')
      const nextOrder = await updateCloudOrderStatus(orderId, 'completed', getAdminToken())
      if (!nextOrder) {
        wx.showToast({
          title: '操作失败',
          icon: 'none',
        })
        return
      }
    } else {
      const { updateOrderStatus } = await import('../../utils/orander')
      updateOrderStatus(orderId, 'completed')
    }

    await this.loadOrders(this.data.ordersPage)
    wx.showToast({
      title: '已完成',
      icon: 'success',
    })
  },

  async loadStats() {
    if (!initCloud()) {
      this.loadLocalStats()
      return
    }

    const stats = await getOrderStatsCloud()
    if (!stats) {
      this.setData({ cloudDegraded: true })
      this.loadLocalStats()
      return
    }

    this.setData({ cloudDegraded: false })
    this.applyStats(stats)
  },

  applyStats(base: OrderStats) {
    const localOrders = getOrders()
    const today = base.today || buildTodayFromOrders(localOrders)
    const daily = base.daily && base.daily.length ? base.daily : buildDailyFromOrders(localOrders)
    const maxRevenue = Math.max(...daily.map((day) => day.revenue), 0)
    const chartDaily = daily.map((day) => ({
      ...day,
      percent: maxRevenue > 0 ? Math.max(4, Math.round((day.revenue / maxRevenue) * 100)) : 0,
    }))

    const topDishes = base.topDishes || []
    const maxQuantity = topDishes.length ? Math.max(...topDishes.map((dish) => dish.quantity)) : 0
    const chartTopDishes = topDishes.map((dish) => ({
      ...dish,
      percent: maxQuantity > 0 ? Math.max(4, Math.round((dish.quantity / maxQuantity) * 100)) : 0,
    }))

    this.setData({
      stats: base,
      statsRevenueText: formatMoney(base.revenue),
      statsToday: today,
      statsTodayRevenueText: formatMoney(today.revenue),
      statsDaily: chartDaily,
      statsTopDishes: chartTopDishes,
    })
  },

  loadLocalStats() {
    const orders = getOrders()
    const revenue = orders.reduce((sum, order) => sum + order.total, 0)
    const dishSales: Record<string, { dishId: string; name: string; quantity: number; revenue: number }> = {}

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!dishSales[item.dishId]) {
          dishSales[item.dishId] = { dishId: item.dishId, name: item.name, quantity: 0, revenue: 0 }
        }
        dishSales[item.dishId].quantity += item.quantity
        dishSales[item.dishId].revenue += item.subtotal
      })
    })

    const topDishes = Object.values(dishSales)
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 10)

    this.applyStats({
      totalOrders: orders.length,
      completedCount: orders.filter((order) => order.status === 'completed').length,
      submittedCount: orders.filter((order) => order.status === 'submitted').length,
      revenue: Number(revenue.toFixed(2)),
      today: buildTodayFromOrders(orders),
      daily: buildDailyFromOrders(orders),
      topDishes,
    })
  },

  async retryCloud() {
    this.setData({ cloudDegraded: false })
    await Promise.all([this.loadOrders(1), this.loadStats()])
  },

  async toggleBusinessStatus() {
    if (this.data.businessSyncing) {
      return
    }

    const nextOpen = !this.data.businessOpen
    wx.vibrateShort({ type: 'light' })
    this.setData({ businessSyncing: true })

    try {
      if (initCloud()) {
        const result = await setBusinessStatusCloud(nextOpen, getAdminToken())
        if (!result) {
          wx.showToast({
            title: '同步失败',
            icon: 'none',
          })
          return
        }
        this.setData({ businessOpen: result.open })
      } else {
        this.setData({ businessOpen: nextOpen })
      }

      wx.showToast({
        title: nextOpen ? '已开始营业' : '已暂停营业',
        icon: 'none',
      })
    } finally {
      this.setData({ businessSyncing: false })
    }
  },

  toggleChefEdit() {
    this.setData({ chefEditing: !this.data.chefEditing, chefInput: this.data.chefName })
  },

  cancelChefEdit() {
    this.setData({ chefEditing: false })
  },

  onChefInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ chefInput: event.detail.value })
  },

  /* ===== 修改管理员密码 ===== */
  togglePwdEdit() {
    this.setData({ pwdEditing: !this.data.pwdEditing, pwdOld: '', pwdNew: '', pwdConfirm: '' })
  },

  cancelPwdEdit() {
    this.setData({ pwdEditing: false })
  },

  onPwdOldInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ pwdOld: event.detail.value })
  },

  onPwdNewInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ pwdNew: event.detail.value })
  },

  onPwdConfirmInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ pwdConfirm: event.detail.value })
  },

  async savePwd() {
    if (this.data.pwdSubmitting) {
      return
    }
    const oldPwd = this.data.pwdOld.trim()
    const newPwd = this.data.pwdNew.trim()
    const confirmPwd = this.data.pwdConfirm.trim()

    if (!oldPwd || !newPwd || !confirmPwd) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }
    if (newPwd.length < 6) {
      wx.showToast({ title: '新密码至少 6 位', icon: 'none' })
      return
    }
    if (newPwd !== confirmPwd) {
      wx.showToast({ title: '两次新密码不一致', icon: 'none' })
      return
    }
    if (newPwd === oldPwd) {
      wx.showToast({ title: '新密码不能与旧密码相同', icon: 'none' })
      return
    }
    if (!initCloud()) {
      wx.showToast({ title: '云服务不可用', icon: 'none' })
      return
    }

    /* 先校验旧密码，避免误改 */
    const verify = await verifyAdminCloud(oldPwd)
    if (!verify) {
      const reason = getLastCloudError()
      if (reason && reason !== '密码错误') {
        wx.showModal({ title: '无法校验密码', content: `${reason}。`, showCancel: false })
        return
      }
      wx.showToast({ title: '旧密码错误', icon: 'none' })
      return
    }

    this.setData({ pwdSubmitting: true })
    try {
      const result = await changeAdminPasswordCloud(getAdminToken(), newPwd)
      if (result && result.adminToken) {
        updateAdminToken(result.adminToken)
        this.setData({ pwdEditing: false })
        wx.showToast({ title: '密码已更新', icon: 'success' })
      } else {
        const reason = getLastCloudError()
        wx.showModal({ title: '修改失败', content: `${reason || '云函数返回异常'}。若云端是旧版本，请先重新部署云函数。`, showCancel: false })
      }
    } finally {
      this.setData({ pwdSubmitting: false })
    }
  },

  async saveChefName() {
    const name = this.data.chefInput.trim()
    if (!name) {
      wx.showToast({ title: '署名不能为空', icon: 'none' })
      return
    }
    if (!initCloud()) {
      wx.showToast({ title: '云服务不可用', icon: 'none' })
      return
    }
    const result = await setBusinessStatusCloud(this.data.businessOpen, getAdminToken(), name)
    if (result) {
      this.setData({ chefName: name, chefEditing: false })
      wx.showToast({ title: '署名已更新', icon: 'none' })
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
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
