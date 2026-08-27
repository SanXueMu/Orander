import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { listAssetsCloud, redeemCardCloud, redeemCodeCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    activeTab: 'code' as 'code' | 'card',
    codeInput: '',
    cardNoInput: '',
    activeCodeInput: '',
    busy: false,
    walletText: '',
    points: 0,
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.navigateTo({ url: '/pages/index/index' })
      return
    }
    applyPageLook(this, getCurrentMember())
    this.refreshBalance()
  },

  async refreshBalance() {
    try {
      const assets = await listAssetsCloud()
      if (assets) {
        this.setData({
          walletText: `¥${Number(assets.wallet || 0).toFixed(2)}`,
          points: Number(assets.points || 0),
        })
      }
    } catch (error) {
      console.warn('[redeem] balance skipped', error)
    }
  },

  switchTab(event: WechatMiniprogram.BaseEvent) {
    const tab = event.currentTarget.dataset.tab as 'code' | 'card'
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab })
    }
  },

  onCodeInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({ codeInput: ((event.detail as { value?: string }).value || '').trim() })
  },

  onCardNoInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({ cardNoInput: ((event.detail as { value?: string }).value || '').trim() })
  },

  onActiveCodeInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({ activeCodeInput: ((event.detail as { value?: string }).value || '').trim() })
  },

  async submitCode() {
    if (this.data.busy) {
      return
    }
    const code = this.data.codeInput
    if (!code) {
      wx.showToast({ title: '请输入兑换码', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    try {
      const reward = (await redeemCodeCloud(code)) || { rewardType: '', rewardValue: '' as unknown }
      const typeText =
        reward.rewardType === 'POINTS' ? `${reward.rewardValue} 积分` : reward.rewardType === 'WALLET' ? `余额 ¥${reward.rewardValue}` : '一张优惠券'
      wx.showModal({
        title: '兑换成功',
        content: `已到账：${typeText}`,
        showCancel: false,
        success: () => this.refreshBalance(),
      })
      this.setData({ codeInput: '', busy: false })
    } catch (error) {
      this.setData({ busy: false })
      const message = error instanceof Error ? String(error.message || error).replace('Error: ', '') : '兑换失败'
      wx.showToast({ title: message.includes('：') ? message.split('：').pop()! : message, icon: 'none' })
    }
  },

  async submitCard() {
    if (this.data.busy) {
      return
    }
    if (!this.data.cardNoInput || !this.data.activeCodeInput) {
      wx.showToast({ title: '请填写卡号与激活码', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    try {
      const card = (await redeemCardCloud(this.data.cardNoInput, this.data.activeCodeInput)) || { cardNo: '', name: '金喜卡' }
      wx.showModal({
        title: '激活成功',
        content: `${card.name}（卡号 ${card.cardNo}）已生效，下单自动享折扣。`,
        showCancel: false,
        success: () => this.refreshBalance(),
      })
      this.setData({ cardNoInput: '', activeCodeInput: '', busy: false })
    } catch (error) {
      this.setData({ busy: false })
      const message = error instanceof Error ? String(error.message || error).replace('Error: ', '') : '激活失败'
      wx.showToast({ title: message.includes('：') ? message.split('：').pop()! : message, icon: 'none' })
    }
  },
})
