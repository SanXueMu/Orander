import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember, getSession } from '../../utils/orander'
import { notifyListCloud, notifyMarkAllReadCloud, notifyMarkReadCloud } from '../../utils/cloud'

interface NotificationItem {
  id: string
  title: string
  content?: string
  read?: boolean
  createdAt?: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    items: [] as NotificationItem[],
    unread: 0,
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    void this.refresh()
  },

  async refresh() {
    if (!getSession()) return
    try {
      const data = (await notifyListCloud().catch(() => null)) || { items: [], unread: 0 }
      this.setData({ items: data.items || [], unread: data.unread || 0 })
    } catch (error) {
      /* 静默 */
    }
  },

  async tapItem(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as { id: string; read: boolean }
    this.setData({
      items: this.data.items.map((item) => (item.id === dataset.id ? { ...item, read: true } : item)),
    })
    if (!dataset.read) {
      try { await notifyMarkReadCloud(dataset.id) } catch (error) { /* 静默 */ }
    }
  },

  async markAll() {
    try {
      await notifyMarkAllReadCloud()
      await this.refresh()
    } catch (error) { /* 静默 */ }
  },
})
