import { clearCart, clearSession, getCurrentMember, getSession, isVisitorSession, loginAdmin, loginVisitor, saveSession, updateCurrentMember } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getLastCloudError, initCloud, syncVisitorMemberCloud, verifyAdminCloud } from '../../utils/cloud'

const NICKNAME_MAX = 16
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

type LoginRole = 'visitor' | 'admin'

Page({
  behaviors: [pageLookBehavior],

  data: {
    /* 账户态 */
    loggedIn: false,
    role: '' as '' | LoginRole,
    nickname: '',
    avatarUrl: '',
    dirty: false,
    busy: false,

    /* 登录区（未登录时） */
    activeRole: 'visitor' as LoginRole,
    adminPassword: '',
    showDebugLogin: false,
    lockHint: '',
  },

  onShow() {
    const session = getSession()
    const member = getCurrentMember()
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      loggedIn: !!session,
      role: session ? (session.role as LoginRole) : '',
      nickname: (member && member.nickname) || (session && session.nickname) || '',
      avatarUrl: (member && member.avatarUrl) || (session && session.avatarUrl) || '',
      dirty: false,
      busy: false,
      showDebugLogin: systemInfo.platform === 'devtools',
      lockHint: '',
    })
    applyPageLook(this, getCurrentMember())
  },

  /* ===== 编辑区（已登录） ===== */
  onNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({ nickname: (event.detail.value || '').slice(0, NICKNAME_MAX), dirty: true })
  },

  onChooseAvatar(event: WechatMiniprogram.CustomEvent) {
    const avatarUrl = String((event.detail as { avatarUrl?: string }).avatarUrl || '')
    if (!avatarUrl) return
    this.setData({ avatarUrl, dirty: true })
  },

  async save() {
    if (this.data.busy || !this.data.loggedIn) return
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    if (this.data.role === 'admin') {
      const session = getSession()
      if (session) {
        saveSession({ ...session, nickname, avatarUrl: this.data.avatarUrl })
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ busy: false, dirty: false })
      return
    }
    updateCurrentMember({ nickname, avatarUrl: this.data.avatarUrl })
    try {
      if (initCloud() && isVisitorSession()) {
        await syncVisitorMemberCloud({ nickname, avatarUrl: this.data.avatarUrl, loginCode: '' })
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ dirty: false })
    } catch (error) {
      wx.showToast({ title: '本地已保存，云端同步暂不可用', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  /* ===== 退出登录（已登录，页面底部） ===== */
  logout() {
    if (!this.data.loggedIn) return
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除当前登录状态，确认退出？',
      confirmText: '退出',
      confirmColor: '#B23A2E',
      success: (res) => {
        if (!res.confirm) return
        clearCart()
        clearSession(true)
        clearAdminFailures()
        wx.showToast({ title: '已退出', icon: 'success' })
        this.onShow()
      },
    })
  },

  /* ===== 登录区（未登录） ===== */
  chooseRole(event: WechatMiniprogram.BaseEvent) {
    this.setData({ activeRole: event.currentTarget.dataset.role as LoginRole, lockHint: '' })
  },

  onPasswordInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({ adminPassword: detail.value || '' })
  },

  login() {
    if (this.data.busy) return
    if (this.data.activeRole === 'admin') {
      const lock = getAdminLockState()
      if (lock.locked) {
        this.setData({ lockHint: `尝试过多，${lock.remainSeconds} 秒后再试` })
        return
      }
      if (!this.data.adminPassword) {
        this.setData({ lockHint: '请输入管理员密码' })
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
        wx.showToast({ title: '登录失败', icon: 'none' })
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
    if (!this.data.showDebugLogin || this.data.busy) return
    if (this.data.activeRole === 'admin') {
      const lock = getAdminLockState()
      if (lock.locked) {
        this.setData({ lockHint: `尝试过多，${lock.remainSeconds} 秒后再试` })
        return
      }
    }
    this.finishLogin({
      nickName: this.data.activeRole === 'admin' ? 'Admin Debug' : '访客 Debug',
      avatarUrl: '',
    }, 'devtools-debug')
  },

  async finishLogin(userInfo?: Partial<WechatMiniprogram.UserInfo>, loginCode = '') {
    if (this.data.activeRole === 'admin') {
      const lock = getAdminLockState()
      if (lock.locked) {
        this.setData({ busy: false, lockHint: `尝试过多，${lock.remainSeconds} 秒后再试` })
        return
      }

      let adminToken: string | undefined
      if (initCloud()) {
        const result = await verifyAdminCloud(this.data.adminPassword)
        if (!result) {
          const cloudReason = getLastCloudError()
          if (cloudReason && cloudReason !== '密码错误') {
            this.setData({ busy: false })
            wx.showModal({
              title: '无法校验密码',
              content: `${cloudReason}。请在微信开发者工具重新上传并部署云函数 orander。`,
              showCancel: false,
            })
            return
          }
          const failState = recordAdminFailure()
          this.setData({
            busy: false,
            lockHint: failState.locked
              ? `连续错误 ${ADMIN_LOCK_MAX_FAILS} 次，锁定 ${failState.remainSeconds} 秒`
              : `密码错误，还可尝试 ${failState.remainAttempts} 次`,
          })
          return
        }
        adminToken = result.adminToken
      }
      clearAdminFailures()
      loginAdmin(userInfo, loginCode, adminToken)
      wx.reLaunch({ url: '/pages/admin/index' })
      return
    }

    loginVisitor(userInfo, loginCode)
    if (initCloud()) {
      const nickname = userInfo && userInfo.nickName ? userInfo.nickName : '访客'
      const avatarUrl = userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : ''
      try {
        await syncVisitorMemberCloud({ nickname, avatarUrl, loginCode })
      } catch (error) {
        console.warn('[profile-edit] visitor sync skipped', error)
      }
    }
    wx.reLaunch({ url: '/pages/dish/index' })
  },
})
