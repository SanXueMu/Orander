import { getAdminToken, loginAdmin } from '../../utils/orander'
import { verifyAdminCloud, adminGetDashboardCloud, canUseCloud } from '../../utils/cloud'

type DailyBar = { date: string; orders: number; gmv: number; barHeight: number }

Page({
  data: {
    adminReady: false,
    password: '',
    todayGmvText: '0',
    todayOrders: 0,
    pendingRefundCount: 0,
    makingCount: 0,
    queueCount: 0,
    totalOrders: 0,
    daily: [] as DailyBar[],
    topDishes: [] as Array<{ spuId: string; name: string; quantity: number; revenue: number }>,
  },

  onLoad() {
    if (getAdminToken()) {
      this.enterAdmin()
    }
  },

  onPasswordInput(event: WechatMiniprogram.Input) {
    this.setData({ password: event.detail.value })
  },

  async submitPassword() {
    const password = this.data.password.trim()
    if (!password) {
      return
    }
    const result = await verifyAdminCloud(password)
    if (!result || !result.adminToken) {
      wx.showToast({ title: '密码错误', icon: 'none' })
      return
    }
    loginAdmin(undefined, '', result.adminToken)
    this.enterAdmin()
  },

  enterAdmin() {
    this.setData({ adminReady: true })
    this.refreshDashboard()
  },

  async refreshDashboard() {
    const token = getAdminToken()
    if (!token || !canUseCloud()) {
      return
    }
    const data = await adminGetDashboardCloud(token)
    if (!data) {
      return
    }
    const daily = (data.daily || []).map((day) => ({
      ...day,
      barHeight: 10 + Math.round((day.orders / Math.max(1, Math.max(...(data.daily || []).map((d) => d.orders), 1))) * 130),
    }))
    const today = data.today || (daily.length ? { orders: daily[daily.length - 1].orders, gmv: daily[daily.length - 1].gmv } : { orders: 0, gmv: 0 })
    const todosFallback = 0
    void todosFallback
    const todos = data.todos || { pendingRefunds: 0, runningActivities: 0, openSessions: 0 }
    this.setData({
      daily,
      todayGmvText: `¥${Number(today.gmv || 0).toFixed(0)}`,
      todayOrders: today.orders || 0,
      pendingRefundCount: Number(todos.pendingRefunds || 0),
      makingCount: Number((data.today && data.today.making) || 0),
      queueCount: Number((data.today && data.today.pendingPrepare) || 0),
      totalOrders: Number((data.total && data.total.orders) || daily.reduce((sum, day) => sum + day.orders, 0)),
      topDishes: (data.topDishes || []).slice(0, 5),
    })
  },

  onShow() {
    if (this.data.adminReady) {
      this.refreshDashboard()
    }
  },

  onPullDownRefresh() {
    this.refreshDashboard().then(() => wx.stopPullDownRefresh())
  },

  goSpus() { wx.navigateTo({ url: '/pages/admin-spus/index' }) },
  goOrders(event: WechatMiniprogram.Touch) {
    const tab = (event.currentTarget.dataset.tab as string) || 'all'
    wx.navigateTo({ url: `/pages/admin-orders/index?tab=${tab}` })
  },
  goQueue() { wx.navigateTo({ url: '/pages/admin-queue/index' }) },
  goStores() { wx.navigateTo({ url: '/pages/admin-stores/index' }) },
  goSettings() { wx.navigateTo({ url: '/pages/admin-settings/index' }) },
  goLegacyUser() { wx.navigateTo({ url: '/pages/admin-user/index' }) },
  comingSoon() { wx.showToast({ title: 'R6b 开放', icon: 'none' }) },
})
