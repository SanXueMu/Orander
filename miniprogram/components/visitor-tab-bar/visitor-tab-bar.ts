Component({
  properties: {
    active: {
      type: String,
      value: 'home',
    },
  },

  methods: {
    goHome() {
      if (this.data.active === 'home') {
        return
      }

      wx.redirectTo({
        url: '/pages/home/index',
      })
    },

    goMenu() {
      if (this.data.active === 'menu') {
        return
      }

      wx.redirectTo({
        url: '/pages/dish/index',
      })
    },

    goMall() {
      if (this.data.active === 'mall') {
        return
      }

      wx.redirectTo({
        url: '/pages/mall/index',
      })
    },

    goProfile() {
      if (this.data.active === 'mine') {
        return
      }

      wx.redirectTo({
        url: '/pages/profile/index',
      })
    },
  },
})
