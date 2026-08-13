Component({
  properties: {
    active: {
      type: String,
      value: 'menu',
    },
  },

  methods: {
    goMenu() {
      if (this.data.active === 'menu') {
        return
      }

      wx.redirectTo({
        url: '/pages/dish/index',
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
