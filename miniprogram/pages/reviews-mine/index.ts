import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { listMyReviewsCloud } from '../../utils/cloud'

interface MyReviewRow {
  id: string
  orderTail: string
  statusKey: string
  statusText: string
  stars: string
  content: string
  reply: string
  date: string
}

interface ReviewDoc {
  id: string
  orderId?: string
  rating?: number
  content?: string
  reply?: string
  status?: string
  createdAt?: string
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '未通过',
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    items: [] as MyReviewRow[],
    loading: true,
    navColor: '',
    navBackground: '',
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
    this.setData({ navColor: '#1a1a1a', navBackground: '#ffffff' })
    void this.load()
  },

  async load() {
    try {
      const data = (await listMyReviewsCloud().catch(() => null)) || { items: [] }
      const docs = (data.items || []) as ReviewDoc[]
      const items: MyReviewRow[] = docs.map((doc) => {
        const rating = Math.max(1, Math.min(5, Number(doc.rating) || 5))
        return {
          id: doc.id,
          orderTail: (doc.orderId || '').slice(-6) || '——',
          statusKey: STATUS_TEXT[doc.status || 'PENDING'] ? doc.status || 'PENDING' : 'PENDING',
          statusText: STATUS_TEXT[doc.status || 'PENDING'] || '审核中',
          stars: '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating),
          content: doc.content || '',
          reply: doc.reply || '',
          date: (doc.createdAt || '').slice(0, 16).replace('T', ' '),
        }
      })
      this.setData({ items, loading: false })
    } catch (_error) {
      this.setData({ items: [], loading: false })
    }
  },
})
