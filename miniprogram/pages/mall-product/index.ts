import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { getMallFloorsCloud, type MallProduct } from '../../utils/cloud'
import { addCartLineV2 } from '../../utils/xicha'

Page({
  behaviors: [pageLookBehavior],

  data: {
    product: null as MallProduct | null,
    priceText: '',
    originText: '',
    busy: false,
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
  },

  async onLoad(query: Record<string, string | undefined>) {
    const id = query.id || ''
    try {
      const data = await getMallFloorsCloud()
      const product = ((data && data.products) || []).find((item) => item.id === id) || null
      this.setData({
        product,
        priceText: product ? `¥${product.price}` : '',
        originText: product && product.originalPrice > product.price ? `¥${product.originalPrice}` : '',
      })
    } catch (error) {
      this.setData({ product: null })
    }
  },

  addToCart() {
    const product = this.data.product
    if (!product) {
      return
    }
    addCartLineV2({
      spuId: `m:${product.id}`,
      name: product.name,
      image: product.image || '',
      basePrice: Number(product.price || 0),
      quantity: 1,
      selections: [],
    })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  goBuy() {
    const product = this.data.product
    if (!product || this.data.busy) {
      return
    }
    this.setData({ busy: true })
    addCartLineV2({
      spuId: `m:${product.id}`,
      name: product.name,
      image: product.image || '',
      basePrice: Number(product.price || 0),
      quantity: 1,
      selections: [],
    })
    wx.navigateTo({ url: '/pages/cart/index' })
    this.setData({ busy: false })
  },
})
