import { getBusinessStatusCloud, getLastCloudError, initCloud, publishLocalDishesToCloud, setBusinessStatusCloud, verifyAdminCloud, changeAdminPasswordCloud } from '../../utils/cloud'
import { clearSession, getAdminToken, isAdminSession, updateAdminToken } from '../../utils/orander'
import { pageLookBehavior } from '../../behaviors/page-look'

Page({
  behaviors: [pageLookBehavior],

  data: {
    chefName: '',
    chefEditing: false,
    chefInput: '',
    pwdEditing: false,
    pwdOld: '',
    pwdNew: '',
    pwdConfirm: '',
    pwdSubmitting: false,
    publishingCloud: false,
  },

  async onShow() {
    if (!isAdminSession()) {
      wx.reLaunch({
        url: '/pages/profile-edit/index',
      })
      return
    }

    if (initCloud()) {
      const status = await getBusinessStatusCloud()
      if (status) {
        this.setData({ chefName: status.chefName || '' })
      }
    }
  },

  /* ===== 掌勺署名 ===== */
  toggleChefEdit() {
    this.setData({ chefEditing: !this.data.chefEditing, chefInput: this.data.chefName })
  },

  cancelChefEdit() {
    this.setData({ chefEditing: false })
  },

  onChefInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ chefInput: event.detail.value })
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
    const result = await setBusinessStatusCloud(true, getAdminToken(), name)
    if (result) {
      this.setData({ chefName: name, chefEditing: false })
      wx.showToast({ title: '署名已更新', icon: 'none' })
    } else {
      wx.showToast({ title: getLastCloudError() || '保存失败', icon: 'none' })
    }
  },

  /* ===== 菜单全量发布 ===== */
  async publishMenuToCloud() {
    if (this.data.publishingCloud) {
      return
    }
    if (!initCloud(true)) {
      wx.showToast({ title: '云开发未就绪', icon: 'none' })
      return
    }

    this.setData({ publishingCloud: true })
    wx.showLoading({ title: '发布中' })

    try {
      const dishes = await publishLocalDishesToCloud(getAdminToken())
      if (!dishes) {
        wx.showToast({ title: '发布失败', icon: 'none' })
        return
      }
      wx.showToast({ title: `已发布${dishes.length}项`, icon: 'success' })
    } finally {
      wx.hideLoading()
      this.setData({ publishingCloud: false })
    }
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
        wx.showModal({ title: '修改失败', content: `${reason || '云函数返回异常'}。`, showCancel: false })
      }
    } finally {
      this.setData({ pwdSubmitting: false })
    }
  },

  /* ===== 退出登录（页面最下方） ===== */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除管理员登录状态，确认退出？',
      confirmText: '退出',
      confirmColor: '#B23A2E',
      success: (res) => {
        if (!res.confirm) return
        clearSession(true)
        wx.showToast({ title: '已退出', icon: 'success' })
        wx.reLaunch({ url: '/pages/profile-edit/index' })
      },
    })
  }
})
