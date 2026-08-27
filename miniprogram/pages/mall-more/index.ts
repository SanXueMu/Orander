import { pageLookBehavior } from '../../behaviors/page-look'
import { getMallFloorsCloud, type MallProduct } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    title: '百货',
    items: [] as MallProduct[],
    loading: true,
  },

  onLoad(query: Record<string, string | undefined>) {
    const floor = query.floor || ''
    const title = query.title ? decodeURIComponent(query.title) : '百货'
    wx.setNavigationBarTitle({ title })
    this.setData({ title, floor })
    this.load(floor)
  },

  async load(floor: string) {
    try {
      const data = await getMallFloorsCloud()
      const items = ((data && data.products) || []).filter((product) => !floor || product.floor === floor)
      this.setData({ items, loading: false })
    } catch (error) {
      this.setData({ items: [], loading: false })
    }
  },

  goProduct(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/mall-product/index?id=${event.currentTarget.dataset.id as string}` })
  },
})
