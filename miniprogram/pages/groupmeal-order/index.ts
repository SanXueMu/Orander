import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember, getSession } from '../../utils/orander'
import { buildMenuGroups, priceUnit, addCartLineV2, getCartLinesV2, setGmSlotMark, type Spu, type CartLineV2 } from '../../utils/xicha'
import { formatMoney } from '../../utils/orander'

interface GmItem extends Spu {
  hasSpecs: boolean
  priceValue: string
  desc: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    slotId: '',
    date: '',
    timeLabel: '',
    remaining: 0,
    soldout: false,
    categories: [] as Array<{ name: string }>,
    railActive: '',
    flowGroups: [] as Array<{ key: string; name: string; items: GmItem[] }>,
    flowInto: '',
    count: 0,
    estimate: '0.00',
    pickerVisible: false,
    pickerSpu: null as Spu | null,
  },

  onLoad(options: Record<string, string>) {
    const remaining = Math.max(0, Number(options.remaining || 0))
    this.setData({
      slotId: options.slotId || '',
      date: options.date || '',
      timeLabel: decodeURIComponent(options.time || ''),
      remaining,
      soldout: remaining <= 0,
    })
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    this.refresh()
  },

  refresh() {
    const flow = buildMenuGroups('')
    const categories = [{ name: '全部' }, ...flow.groups.map((group) => ({ name: group.name }))]
    const flowGroups = flow.groups.map((group) => ({
      key: group.key,
      name: group.name,
      items: group.items.map((spu) => ({
        ...spu,
        hasSpecs: !!(spu.specGroups && spu.specGroups.length > 0),
        priceValue: String(spu.basePrice),
        desc: spu.description || '',
      })),
    }))
    this.setData({
      categories,
      railActive: this.data.railActive && categories.some((c) => c.name === this.data.railActive) ? this.data.railActive : '全部',
      flowGroups,
    })
    this.recount()
  },

  recount() {
    const lines = getCartLinesV2().filter((line) => !line.spuId.startsWith('m:'))
    let total = 0
    lines.forEach((line) => {
      total += priceUnit(line.basePrice, line.selections) * line.quantity
    })
    this.setData({ count: lines.reduce((sum, line) => sum + line.quantity, 0), estimate: formatMoney(Number(total.toFixed(2))) })
  },

  tapRailCategory(event: WechatMiniprogram.BaseEvent) {
    const category = event.currentTarget.dataset.category as string
    const group = this.data.flowGroups.find((item) => item.name === category || category === '全部')
    this.setData({ railActive: category, flowInto: group ? `flow-${group.key}` : '' })
  },

  addPlain(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    let target: Spu | null = null
    this.data.flowGroups.forEach((group) => {
      const found = group.items.find((item) => item.id === id)
      if (found) {
        target = found
      }
    })
    if (!target) {
      return
    }
    const spu = target as Spu
    addCartLineV2({
      spuId: spu.id,
      name: spu.name,
      image: spu.image,
      basePrice: spu.basePrice,
      quantity: 1,
      selections: [],
    })
    wx.vibrateShort({ type: 'light' })
    this.recount()
  },

  openSpecPicker(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    let target: Spu | null = null
    this.data.flowGroups.forEach((group) => {
      const found = group.items.find((item) => item.id === id)
      if (found) {
        target = found
      }
    })
    if (target) {
      this.setData({ pickerVisible: true, pickerSpu: target })
    }
  },

  onPickerClose() {
    this.setData({ pickerVisible: false })
  },

  onPickerAdd(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { line: Omit<CartLineV2, 'key'> }
    if (detail && detail.line) {
      addCartLineV2(detail.line)
      this.recount()
      wx.showToast({ title: '已加入', icon: 'none' })
    }
  },

  goSettle() {
    if (this.data.soldout) {
      wx.showToast({ title: '该时段已订满', icon: 'none' })
      return
    }
    if (!getSession()) {
      wx.showModal({
        title: '登录后下单',
        content: '提交团餐订单需要先登录身份。',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile-edit/index' })
          }
        },
      })
      return
    }
    setGmSlotMark({ slotId: this.data.slotId, date: this.data.date, time: this.data.timeLabel })
    wx.navigateTo({ url: '/pages/cart/index' })
  },
})
