import { initCloud, syncVisitorMemberCloud, verifyAdminCloud } from '../../utils/cloud'
import {
  clearCart,
  clearSession,
  getSession,
  loginAdmin,
  loginVisitor,
  verifyAdminPassword,
} from '../../utils/orander'
import type { SessionRole } from '../../utils/orander'
import { pageLookBehavior } from '../../behaviors/page-look'

const ROLE_TABS: Array<{ id: SessionRole; label: string }> = [
  { id: 'visitor', label: '访客' },
  { id: 'admin', label: '管理员' },
]

const ADMIN_LOCK_MAX_FAILS = 5
const ADMIN_LOCK_MS = 60 * 1000
const ADMIN_FAIL_COUNT_KEY = 'orander-admin-fail-count'
const ADMIN_LOCKED_UNTIL_KEY = 'orander-admin-locked-until'

const getAdminLockState = () => {
  const lockedUntil = Number(wx.getStorageSync(ADMIN_LOCKED_UNTIL_KEY) || 0)
  if (lockedUntil && Date.now() < lockedUntil) {
    return { locked: true, remainSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) }
  }

  return { locked: false, remainSeconds: 0 }
}

const recordAdminFailure = () => {
  const count = Number(wx.getStorageSync(ADMIN_FAIL_COUNT_KEY) || 0) + 1
  if (count >= ADMIN_LOCK_MAX_FAILS) {
    wx.setStorageSync(ADMIN_FAIL_COUNT_KEY, 0)
    wx.setStorageSync(ADMIN_LOCKED_UNTIL_KEY, Date.now() + ADMIN_LOCK_MS)
    return { locked: true, remainSeconds: Math.ceil(ADMIN_LOCK_MS / 1000), remainAttempts: 0 }
  }

  wx.setStorageSync(ADMIN_FAIL_COUNT_KEY, count)
  return { locked: false, remainSeconds: 0, remainAttempts: ADMIN_LOCK_MAX_FAILS - count }
}

const clearAdminFailures = () => {
  wx.removeStorageSync(ADMIN_FAIL_COUNT_KEY)
  wx.removeStorageSync(ADMIN_LOCKED_UNTIL_KEY)
}

Page({
  behaviors: [pageLookBehavior],

  data: {
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

    if (this.data.activeRole === 'admin') {
      const lock = getAdminLockState()
      if (lock.locked) {
        wx.showToast({
          title: `尝试过多，${lock.remainSeconds} 秒后再试`,
          icon: 'none',
        })
        return
      }

      if (!verifyAdminPassword(this.data.adminPassword)) {
        const failState = recordAdminFailure()
        wx.showToast({
          title: failState.locked
            ? `连续错误 ${ADMIN_LOCK_MAX_FAILS} 次，锁定 ${failState.remainSeconds} 秒`
            : `密码错误，还可尝试 ${failState.remainAttempts} 次`,
          icon: 'none',
        })
        return
      }
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

    if (this.data.activeRole === 'admin') {
      const lock = getAdminLockState()
      if (lock.locked) {
        wx.showToast({
          title: `尝试过多，${lock.remainSeconds} 秒后再试`,
          icon: 'none',
        })
        return
      }

      if (!verifyAdminPassword(this.data.adminPassword)) {
        const failState = recordAdminFailure()
        wx.showToast({
          title: failState.locked
            ? `连续错误 ${ADMIN_LOCK_MAX_FAILS} 次，锁定 ${failState.remainSeconds} 秒`
            : `密码错误，还可尝试 ${failState.remainAttempts} 次`,
          icon: 'none',
        })
        return
      }
    }

    this.finishLogin({
      nickName: this.data.activeRole === 'admin' ? 'Admin Debug' : '访客 Debug',
      avatarUrl: '',
    }, 'devtools-debug')
  },

  async finishLogin(userInfo?: Partial<WechatMiniprogram.UserInfo>, loginCode = '') {
    this.setData({ busy: false })

    if (this.data.activeRole === 'admin') {
      let adminToken: string | undefined
      if (initCloud()) {
        const lock = getAdminLockState()
        if (lock.locked) {
          wx.showToast({
            title: `尝试过多，${lock.remainSeconds} 秒后再试`,
            icon: 'none',
          })
          return
        }

        const result = await verifyAdminCloud(this.data.adminPassword)
        if (!result) {
          const failState = recordAdminFailure()
          wx.showToast({
            title: failState.locked
              ? `连续错误 ${ADMIN_LOCK_MAX_FAILS} 次，锁定 ${failState.remainSeconds} 秒`
              : `密码错误，还可尝试 ${failState.remainAttempts} 次`,
            icon: 'none',
          })
          return
        }
        adminToken = result.adminToken
      }
      clearAdminFailures()
      loginAdmin(userInfo, loginCode, adminToken)
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
