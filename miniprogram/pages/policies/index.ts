import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { getPoliciesCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    items: [] as Array<{ id: string; title: string; version?: string }>,
    loading: true,
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    void this.load()
  },

  async load() {
    try {
      const data = (await getPoliciesCloud().catch(() => null)) || { items: [], unread: 0 }
      this.setData({ items: data.items || [], loading: false })
    } catch (error) {
      this.setData({ items: [], loading: false })
    }
  },

  goDetail(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/pages/policy-detail/index?id=${event.currentTarget.dataset.id as string}` })
  },
})
