import { formatMoney, getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { listAssetsCloud, listPointsFlowCloud, type PointsFlow } from '../../utils/cloud'

type FlowView = {
  id: string
  deltaText: string
  positive: boolean
  reason: string
  dateText: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    walletText: formatMoney(0),
    points: 0,
    flows: [] as FlowView[],
    loading: true,
    cloudOk: true,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.navigateTo({ url: '/pages/index/index' })
      return
    }
    applyPageLook(this, getCurrentMember())
    this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const assets = await listAssetsCloud()
      let flowViews: FlowView[] = []
      try {
        const flowResult = await listPointsFlowCloud()
        const items = (flowResult && flowResult.items ? flowResult.items : []) as PointsFlow[]
        flowViews = items.slice(0, 50).map((flow) => ({
          id: String(flow.id || Math.random()),
          deltaText: `${Number(flow.delta || 0) >= 0 ? '+' : ''}${flow.delta}`,
          positive: Number(flow.delta || 0) >= 0,
          reason: String(flow.reason || '积分变动'),
          dateText: String(flow.at || '').slice(5, 16).replace('T', ' '),
        }))
      } catch (error) {
        console.warn('[wallet] points flow skipped', error)
      }
      this.setData({
        walletText: formatMoney(Number(assets && assets.wallet ? assets.wallet : 0)),
        points: assets && assets.points ? assets.points : 0,
        flows: flowViews,
        loading: false,
        cloudOk: true,
      })
    } catch (error) {
      console.error('[wallet] refresh failed', error)
      this.setData({ loading: false, cloudOk: false })
    }
  },

  goRedeem() {
    wx.navigateTo({ url: '/pages/redeem/index' })
  },
})
