Component({
  properties: {
    quantity: {
      type: Number,
      value: 0,
    },
    dishId: {
      type: String,
      value: '',
    },
    variant: {
      type: String,
      value: 'menu',
    },
  },

  methods: {
    onMinus() {
      this.triggerEvent('minus', { id: this.properties.dishId })
    },

    onPlus() {
      this.triggerEvent('plus', { id: this.properties.dishId })
    },
  },
})
