import { getAdminToken } from '../../utils/orander'
import { adminListInvoicesCloud, adminIssueInvoiceCloud } from '../../utils/cloud'

type InvoiceRow = Record<string, unknown> & {
  id: string; status?: string; amount?: number; titleName?: string; titleTaxNo?: string; bizType?: string; createdAt?: string; invoiceNo?: string
}

Page({
  data: {
    loading: true,
    invoices: [] as InvoiceRow[],
  },

  onShow() {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    void this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    const token = getAdminToken()
    if (!token) return
    const data = await adminListInvoicesCloud(token).catch(() => null)
    this.setData({ invoices: ((data && data.items) || []) as InvoiceRow[], loading: false })
  },

  async issue(event: WechatMiniprogram.TouchEvent) {
    const token = getAdminToken()
    const id = String(event.currentTarget.dataset.id)
    if (!token || !id) return
    await adminIssueInvoiceCloud(token, id)
    wx.showToast({ title: '已开具', icon: 'success' })
    void this.refresh()
  },

  statusLabel(value?: string) {
    const label: Record<string, string> = { PENDING: '待开', ISSUED: '已开', REJECTED: '已拒绝' }
    return label[String(value || 'PENDING')] || '待开'
  },
})
