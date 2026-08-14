import { createCloudOrder, initCloud } from '../../utils/cloud'
import {
  buildCartLines,
  formatMoney,
  getCartStats,
  getCurrentMember,
  getRelationLabel,
  getSession,
  isVisitorSession,
  removeFromCart,
  setCartQuantity,
  clearCart,
  createOrder,
} from '../../utils/orander'
import { MAX_CART_QUANTITY } from '../../utils/orander'
import { eventBus } from '../../utils/event-bus'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

type CartLineView = ReturnType<typeof buildCartLines>[number] & { subtotalText: string }

const resolveDishId = (event: WechatMiniprogram.BaseEvent) => {
  const detail = (event as WechatMiniprogram.CustomEvent).detail as { id?: string } | undefined
  return (detail && detail.id) || (event.currentTarget.dataset.id as string)
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '访客',
    note: '',
    noteFocused: false,
    swipedLineId: '',
    touchStartX: 0,
    touchStartY: 0,
    submitting: false,
    lines: [] as CartLineView[],
    totalText: formatMoney(0),
  },

  onShow() {
    if (!isVisitorSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    this.refreshPage()
  },

  refreshPage() {
    const session = getSession()
    applyPageLook(this, getCurrentMember())
    const stats = getCartStats()
    const lines: CartLineView[] = buildCartLines().map((line) => ({
      ...line,
      subtotalText: formatMoney(line.subtotal),
    }))

    this.setData({
      nickname: session ? session.nickname : '访客',
      lines,
      totalText: formatMoney(stats.total),
    })
    eventBus.emit('cart-changed', { count: stats.count })
  },

  vibrateLight() {
    wx.vibrateShort({ type: 'light' })
  },

  increaseQuantity(event: WechatMiniprogram.BaseEvent) {
    const dishId = resolveDishId(event)
    const line = buildCartLines().find((item) => item.dishId === dishId)
    if (!line) {
      return
    }

    if (line.quantity >= MAX_CART_QUANTITY) {
      wx.showToast({
        title: `每样菜品最多 ${MAX_CART_QUANTITY} 份`,
        icon: 'none',
      })
      return
    }

    setCartQuantity(dishId, line.quantity + 1)
    this.vibrateLight()
    this.refreshPage()
  },

  decreaseQuantity(event: WechatMiniprogram.BaseEvent) {
    const dishId = resolveDishId(event)
    const line = buildCartLines().find((item) => item.dishId === dishId)
    if (!line) {
      return
    }

    setCartQuantity(dishId, line.quantity - 1)
    this.refreshPage()
  },

  onLineTouchStart(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches[0]
    this.setData({
      touchStartX: touch ? touch.clientX : 0,
      touchStartY: touch ? touch.clientY : 0,
    })
  },

  onLineTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches[0]
    const endX = touch ? touch.clientX : 0
    const endY = touch ? touch.clientY : 0
    const deltaX = endX - this.data.touchStartX
    const deltaY = endY - this.data.touchStartY
    const lineId = event.currentTarget.dataset.id as string

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    if (deltaX < -36) {
      this.setData({
        swipedLineId: lineId,
      })
      return
    }

    if (deltaX > 20 || this.data.swipedLineId === lineId) {
      this.setData({
        swipedLineId: '',
      })
    }
  },

  removeLine(event: WechatMiniprogram.BaseEvent) {
    const dishId = event.currentTarget.dataset.id as string
    const line = buildCartLines().find((item) => item.dishId === dishId)
    if (!line) {
      return
    }

    wx.showModal({
      title: '移除菜品',
      content: `确定把「${line.dish.name}」从账单中移除吗？`,
      success: (result) => {
        if (!result.confirm) {
          return
        }

        removeFromCart(dishId)
        this.setData({ swipedLineId: '' })
        this.refreshPage()
      },
    })
  },

  onNoteInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({
      note: detail.value || '',
    })
  },

  onNoteFocus() {
    this.setData({ noteFocused: true })
  },

  onNoteBlur() {
    this.setData({ noteFocused: false })
  },

  submitOrder() {
    if (this.data.submitting) {
      return
    }

    const profile = getCurrentMember()
    const lines = buildCartLines()
    if (!profile || !lines.length) {
      wx.showToast({
        title: '账单为空',
        icon: 'none',
      })
      return
    }

    const note = this.data.note.trim()
    this.setData({ submitting: true })

    const finishSubmit = () => {
      this.setData({ submitting: false })
    }

    const submitLocal = () => {
      const order = createOrder(note)
      if (!order) {
        finishSubmit()
        wx.showToast({
          title: '账单为空',
          icon: 'none',
        })
        return
      }

      eventBus.emit('order-created', { orderId: order.id })
      wx.vibrateShort({ type: 'light' })
      wx.redirectTo({
        url: `/pages/receipt/index?id=${order.id}`,
      })
    }

    if (!initCloud()) {
      submitLocal()
      return
    }

    wx.showLoading({ title: '下单中' })
    createCloudOrder({
      memberId: profile.id,
      nickname: profile.nickname,
      relationLabel: getRelationLabel(profile),
      total: lines.reduce((result, line) => result + line.subtotal, 0),
      note,
      items: lines.map((line) => ({
        dishId: line.dish.id,
        name: line.dish.name,
        price: line.dish.price,
        quantity: line.quantity,
        subtotal: line.subtotal,
        image: line.dish.image,
      })),
    }).then((order) => {
      wx.hideLoading()
      if (!order) {
        submitLocal()
        return
      }

      clearCart()
      eventBus.emit('order-created', { orderId: order.id })
      wx.vibrateShort({ type: 'light' })
      wx.redirectTo({
        url: `/pages/receipt/index?id=${order.id}`,
      })
    }).catch(() => {
      wx.hideLoading()
      submitLocal()
    })
  },

  backMenu() {
    wx.redirectTo({
      url: '/pages/dish/index',
    })
  },
})
