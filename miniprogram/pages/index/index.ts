import { initCloud, syncVisitorMemberCloud } from '../../utils/cloud'
import {
  clearCart,
  clearSession,
  getSession,
  loginAdmin,
  loginVisitor,
  verifyAdminPassword,
} from '../../utils/orander'
import type { SessionRole } from '../../utils/orander'

const ROLE_TABS: Array<{ id: SessionRole; label: string }> = [
  { id: 'visitor', label: '访客' },
  { id: 'admin', label: '管理员' },
]

Page({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#111111',
    navBackground: '#f4f4f4',
    roleTabs: ROLE_TABS,
    activeRole: 'visitor' as SessionRole,
    adminPassword: '',
    busy: false,
    sessionHint: '',
    showDebugLogin: false,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      showDebugLogin: systemInfo.platform === 'devtools',
    })
  },

  onShow() {
    const session = getSession()
    this.setData({
      sessionHint: session ? `${session.nickname}` : '',
      busy: false,
    })
  },

  chooseRole(event: WechatMiniprogram.BaseEvent) {
    const role = event.currentTarget.dataset.role as SessionRole
    this.setData({
      activeRole: role,
    })
  },

  onPasswordInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({
      adminPassword: detail.value || '',
    })
  },

  continueSession() {
    const session = getSession()
    if (!session) {
      return
    }

    wx.reLaunch({
      url: session.role === 'admin' ? '/pages/admin/index' : '/pages/dish/index',
    })
  },

  resetSession() {
    clearCart()
    clearSession(false)
    this.setData({
      sessionHint: '',
      adminPassword: '',
    })
    wx.showToast({
      title: '已退出',
      icon: 'success',
    })
  },

  login() {
    if (this.data.busy) {
      return
    }

    if (this.data.activeRole === 'admin' && !verifyAdminPassword(this.data.adminPassword)) {
      wx.showToast({
        title: '密码错误',
        icon: 'none',
      })
      return
    }

    this.setData({ busy: true })

    wx.login({
      success: (loginResult) => {
        this.requestProfile(loginResult.code || '')
      },
      fail: () => {
        this.setData({ busy: false })
        wx.showToast({
          title: '登录失败',
          icon: 'none',
        })
      },
    })
  },

  requestProfile(loginCode: string) {
    if (typeof wx.getUserProfile !== 'function') {
      this.finishLogin(undefined, loginCode)
      return
    }

    wx.getUserProfile({
      desc: '用于登录 Orander',
      success: (result) => {
        this.finishLogin(result.userInfo, loginCode)
      },
      fail: () => {
        this.finishLogin(undefined, loginCode)
      },
    })
  },

  debugLogin() {
    if (!this.data.showDebugLogin || this.data.busy) {
      return
    }

    if (this.data.activeRole === 'admin' && !verifyAdminPassword(this.data.adminPassword)) {
      wx.showToast({
        title: '密码错误',
        icon: 'none',
      })
      return
    }

    this.finishLogin({
      nickName: this.data.activeRole === 'admin' ? 'Admin Debug' : '访客 Debug',
      avatarUrl: '',
    }, 'devtools-debug')
  },

  async finishLogin(userInfo?: Partial<WechatMiniprogram.UserInfo>, loginCode = '') {
    this.setData({ busy: false })

    if (this.data.activeRole === 'admin') {
      loginAdmin(userInfo, loginCode)
      wx.reLaunch({
        url: '/pages/admin/index',
      })
      return
    }

    loginVisitor(userInfo, loginCode)
    if (initCloud()) {
      const nickname = userInfo && userInfo.nickName ? userInfo.nickName : '访客'
      const avatarUrl = userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : ''
      await syncVisitorMemberCloud({
        nickname,
        avatarUrl,
        loginCode,
      })
    }

    wx.reLaunch({
      url: '/pages/dish/index',
    })
  },
})
