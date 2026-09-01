import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember, getSession } from '../../utils/orander'
import { gmGetSlotsCloud, gmMyReservationsCloud, gmReserveSlotCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    date: '',
    slots: [] as Array<{ id: string; label: string; remaining: number; capacity: number; active?: boolean; full?: boolean }>,
    headcount: 10,
    contactName: '',
    phone: '',
    note: '',
    selectedSlot: '',
    reserving: false,
    reservations: [] as unknown[],
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    if (!this.data.date) {
      this.setData({ date: this.today() })
    }
    void this.refresh()
  },

  today() {
    return new Date().toISOString().slice(0, 10)
  },

  async refresh() {
    try {
      const [slotRes, mineRes] = await Promise.all([
        gmGetSlotsCloud(this.data.date),
        gmMyReservationsCloud(),
      ])
      const slotData = slotRes || { date: this.data.date, slots: [] }
      const mine = mineRes || { items: [] }
      const slots = (slotData.slots || []).map((slot) => ({
        id: slot.id,
        label: slot.time,
        remaining: slot.remaining,
        capacity: slot.capacity,
        full: slot.remaining <= 0,
        active: slot.id === this.data.selectedSlot,
      }))
      this.setData({ slots, reservations: mine.items || [] })
    } catch (error) {
      wx.showToast({ title: '档期加载失败', icon: 'none' })
    }
  },

  onDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ date: String(event.detail.value), selectedSlot: '' })
    void this.refresh()
  },

  pickSlot(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as { id: string; full: boolean }
    if (dataset.full) return
    this.setData({
      selectedSlot: dataset.id,
      slots: this.data.slots.map((s) => ({ ...s, active: s.id === dataset.id })),
    })
  },

  minusCount() {
    this.setData({ headcount: Math.max(1, this.data.headcount - 1) })
  },

  plusCount() {
    this.setData({ headcount: Math.min(200, this.data.headcount + 1) })
  },

  onName(event: WechatMiniprogram.Input) { this.setData({ contactName: event.detail.value }) },
  onPhone(event: WechatMiniprogram.Input) { this.setData({ phone: event.detail.value }) },
  onNote(event: WechatMiniprogram.Input) { this.setData({ note: event.detail.value }) },

  async reserve() {
    if (!getSession()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!this.data.selectedSlot) {
      wx.showToast({ title: '请选择时段', icon: 'none' })
      return
    }
    if (this.data.reserving) return
    this.setData({ reserving: true })
    try {
      await gmReserveSlotCloud({
        slotId: this.data.selectedSlot,
        date: this.data.date,
        headcount: this.data.headcount,
        contactName: this.data.contactName.trim(),
        phone: this.data.phone.trim(),
        note: this.data.note.trim(),
      })
      const picked = this.data.slots.find((s) => s.id === this.data.selectedSlot)
      wx.showModal({
        title: '预约成功',
        content: `已预约 ${this.data.date} ${picked ? picked.label : ''}，现在去挑选团餐菜品？`,
        confirmText: '去点单',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm && picked) {
            wx.navigateTo({
              url: `/pages/groupmeal-order/index?slotId=${picked.id}&date=${this.data.date}&time=${encodeURIComponent(picked.label)}&remaining=${picked.remaining}`,
            })
          }
        },
      })
      await this.refresh()
    } catch (error) {
      wx.showToast({ title: (error as Error).message || '预约失败', icon: 'none' })
    } finally {
      this.setData({ reserving: false })
    }
  },
})
