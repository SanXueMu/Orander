import { getCurrentMember } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getMallFloorsCloud, getBannersCloud, type MallProduct } from '../../utils/cloud'

const FLOOR_FALLBACK: Record<string, string> = {
  new: '灵感上新',
  bottle: '喜茶瓶装',
  gift: '茶礼盒',
  goods: '灵感周边',
}

interface FloorSection {
  key: string
  title: string
  items: MallProduct[]
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    sections: [] as FloorSection[],
    activeFloor: '',
    scrollInto: '',
    loading: true,
    banners: [] as Array<{ id: string; title?: string; image?: string; link?: string }>,
    bannerCur: 0,
  },

  onBannerChange(event: WechatMiniprogram.SwiperChange) {
    this.setData({ bannerCur: event.detail.current })
  },

  bannerStep(event: WechatMiniprogram.TouchEvent) {
    const step = Number(event.currentTarget.dataset.step) || 1
    const total = this.data.banners.length
    if (!total) return
    this.setData({ bannerCur: (this.data.bannerCur + step + total) % total })
  },

  onBannerTap(event: WechatMiniprogram.TouchEvent) {
    const link = String(event.currentTarget.dataset.link || '')
    if (link && link.startsWith('/pages/')) {
      wx.navigateTo({ url: link })
    }
  },

  onShow() {
    getBannersCloud('mall').then((result) => {
      const items = ((result && result.items) || []) as typeof this.data.banners
      this.setData({ banners: items.filter((item) => item.image || item.title) })
    }).catch(() => null)
    applyPageLook(this, getCurrentMember())
    this.load()
  },

  async load() {
    try {
      const data = await getMallFloorsCloud()
      const products = (data && data.products) || []
      const orderKey: string[] = []
      const buckets = new Map<string, MallProduct[]>()
      products.forEach((product) => {
        const key = product.floor || 'new'
        if (!buckets.has(key)) {
          buckets.set(key, [])
          orderKey.push(key)
        }
        const bucket = buckets.get(key)
        if (bucket) {
          bucket.push(product)
        }
      })
      const sections = orderKey.map((key) => {
        const list = buckets.get(key) || []
        return {
          key,
          title: (list[0] && list[0].floorName) || FLOOR_FALLBACK[key] || key,
          items: list,
        }
      })
      this.setData({
        sections,
        loading: false,
        activeFloor: this.data.activeFloor || (sections[0] ? sections[0].key : ''),
      })
    } catch (error) {
      console.warn('[mall] floors unavailable', error)
      this.setData({ sections: [], loading: false })
    }
  },

  onFloorTap(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ activeFloor: key, scrollInto: `floor-${key}` })
  },

  goMore(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as { floor?: string; title?: string }
    wx.navigateTo({
      url: `/pages/mall-more/index?floor=${dataset.floor || ''}&title=${encodeURIComponent(dataset.title || '')}`,
    })
  },

  goProduct(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/mall-product/index?id=${event.currentTarget.dataset.id as string}` })
  },
})
