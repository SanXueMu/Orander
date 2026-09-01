import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { eventBus } from '../../utils/event-bus'
import {
  cacheOrder,
  formatMoney,
  getCurrentMember,
  getSession,
} from '../../utils/orander'
import {
  clearCartV2,
  clearGmSlotMark,
  getCartLinesV2,
  getCartStatsV2,
  getFulfillMode,
  getGmSlotMark,
  getSelectedStore,
  priceUnit,
  removeCartLineV2,
  selectionsText,
  setCartLineQtyV2,
} from '../../utils/xicha'
import { createOrderV2Cloud, initCloud, payOrderCloud } from '../../utils/cloud'

type LineView = {
  key: string
  name: string
  image: string
  coverStyle: string
  specText: string
  unitText: string
  subtotalText: string
  quantity: number
}

const COVER_BACKGROUNDS = [
  'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
  'linear-gradient(135deg, #2a2a2a 0%, #6a6a6a 100%)',
  'linear-gradient(135deg, #050505 0%, #585858 100%)',
]

const hashString = (value: string) => {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

const buildLineViews = (): { lines: LineView[]; totalText: string; countText: number } => {
  const stats = getCartStatsV2()
  const lines = getCartLinesV2().map((line) => {
    const unit = priceUnit(line.basePrice, line.selections)
    const specText = selectionsText(line.selections)
    return {
      key: line.key,
      name: line.name,
      image: line.image || '',
      coverStyle: `background:${COVER_BACKGROUNDS[hashString(line.spuId) % COVER_BACKGROUNDS.length]};`,
      specText,
      unitText: formatMoney(unit),
      subtotalText: formatMoney(Number((unit * line.quantity).toFixed(2))),
      quantity: line.quantity,
    }
  })
  return { lines, totalText: formatMoney(stats.total), countText: stats.count }
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '访客',
    storeName: '',
    modeLabel: '到店取',
    lines: [] as LineView[],
    totalText: formatMoney(0),
    countText: 0,
    note: '',
    noteFocused: false,
    swipedLineId: '',
    submitting: false,
    /* 模拟支付面板 */
    payVisible: false,
    payAmountText: formatMoney(0),
    paying: false,
    pendingOrderId: '',
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    this.refresh()
  },

  refresh() {
    const session = getSession()
    const store = getSelectedStore()
    const mode = getFulfillMode()
    const views = buildLineViews()
    this.setData({
      nickname: session ? session.nickname : '访客',
      storeName: store ? store.name : 'Orander GO',
      modeLabel: mode === 'DELIVERY' ? '喜外送' : '到店取',
      ...views,
    })
  },

  /* ===== 行操作 ===== */

  onLineTouchStart(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string
    this._touchStartX = event.touches[0].clientX
    this.setData({ swipedLineId: this.data.swipedLineId === id ? '' : this.data.swipedLineId })
  },

  _touchStartX: 0,

  onLineTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const deltaX = event.changedTouches[0].clientX - this._touchStartX
    if (deltaX < -40) {
      this.setData({ swipedLineId: event.currentTarget.dataset.id as string })
    } else if (deltaX > 40) {
      this.setData({ swipedLineId: '' })
    }
  },

  removeLine(event: WechatMiniprogram.BaseEvent) {
    removeCartLineV2(event.currentTarget.dataset.id as string)
    this.refresh()
  },

  increaseQuantity(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.id as string
    const line = getCartLinesV2().find((item) => item.key === key)
    if (!line || line.quantity >= 99) {
      return
    }
    setCartLineQtyV2(key, line.quantity + 1)
    this.refresh()
  },

  decreaseQuantity(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.id as string
    const line = getCartLinesV2().find((item) => item.key === key)
    if (!line) {
      return
    }
    setCartLineQtyV2(key, line.quantity - 1)
    this.refresh()
  },

  onNoteInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({ note: (event.detail as { value?: string }).value || '' })
  },

  onNoteFocus() {
    this.setData({ noteFocused: true })
  },

  onNoteBlur() {
    this.setData({ noteFocused: false })
  },

  backMenu() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/dish/index' }),
    })
  },

  /* ===== 下单（服务端计价）→ 模拟支付 ===== */

  async submitOrder() {
    if (this.data.submitting) {
      return
    }
    if (!this.data.lines.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }

    const store = getSelectedStore()

    if (!initCloud()) {
      wx.showModal({
        title: '云端不可用',
        content: '未检测到云开发环境，暂时无法下单。',
        showCancel: false,
      })
      return
    }

    this.setData({ submitting: true })
    try {
      const gmMark = getGmSlotMark()
      const order = await createOrderV2Cloud({
        storeId: store ? store.id : '',
        mode: getFulfillMode(),
        biz: getCartLinesV2().some((line) => line.spuId.startsWith('m:')) ? 'MALL' : 'TEA',
        note: gmMark ? `【团餐 ${gmMark.date} ${gmMark.time}】${this.data.note.trim()}` : this.data.note.trim(),
        groupmeal: gmMark ? { slotId: gmMark.slotId, date: gmMark.date, time: gmMark.time } : undefined,
        items: getCartLinesV2().map((line) => ({
          spuId: line.spuId.startsWith('legacy:') ? line.spuId.slice('legacy:'.length) : line.spuId,
          qty: line.quantity,
          selections: line.selections.map((ref) => ({ groupId: ref.groupId, optionId: ref.optionId })),
        })),
      })

      if (!order || !order.id) {
        throw new Error('no order')
      }
      clearGmSlotMark()

      cacheOrder(order as unknown as Parameters<typeof cacheOrder>[0])
      this.setData({
        submitting: false,
        payVisible: true,
        payAmountText: formatMoney(order.total),
        pendingOrderId: order.id,
      })
    } catch (error) {
      console.error('[cart] createOrderV2 failed', error)
      this.setData({ submitting: false })
      wx.showModal({
        title: '下单失败',
        content: '云端服务暂不可用，请稍后重试（确认云函数 orander 已部署 R1 新版）。',
        showCancel: false,
      })
    }
  },

  closePaySheet() {
    if (this.data.paying) {
      return
    }
    this.setData({ payVisible: false })
  },

  stopBubble() {},

  async confirmPay() {
    if (this.data.paying || !this.data.pendingOrderId) {
      return
    }
    this.setData({ paying: true })
    try {
      const paid = await payOrderCloud(this.data.pendingOrderId)
      await new Promise<void>((resolve) => setTimeout(resolve, 700))
      this.setData({ paying: false, payVisible: false, pendingOrderId: '' })
      clearCartV2()
      eventBus.emit('order-created', { orderId: this.data.pendingOrderId || '' })
      if (paid && typeof paid.queueNo !== 'undefined') {
        wx.setStorageSync('xc-last-queue', paid.queueNo)
      }
      wx.redirectTo({
        url: `/pages/receipt/index?id=${this.data.pendingOrderId}&justPaid=1`,
      })
    } catch (error) {
      console.error('[cart] payOrder failed', error)
      this.setData({ paying: false })
      wx.showToast({ title: '支付失败，请重试', icon: 'none' })
    }
  },
})
