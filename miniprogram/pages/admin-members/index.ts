import { getAdminToken } from '../../utils/orander'
import { adminListMembersCloud } from '../../utils/cloud'

type MemberRow = Record<string, unknown> & {
  id: string; nickname?: string; growthValue?: number; level?: string; ordersCount?: number; lastOrderAt?: string; joinedAt?: string
}

const fmtDate = (value?: string) => (value ? String(value).slice(0, 10) : '-')

Page({
  data: {
    loading: true,
    keyword: '',
    total: 0,
    members: [] as MemberRow[],
    shown: [] as MemberRow[],
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
    const data = await adminListMembersCloud(token).catch(() => null)
    const members = ((data && data.items) || []) as MemberRow[]
    this.setData({ members, total: members.length, loading: false })
    this.applyFilter()
  },

  applyFilter() {
    const keyword = this.data.keyword.trim()
    const shown = keyword
      ? this.data.members.filter((member) => String(member.nickname || member.id || '').includes(keyword))
      : this.data.members
    this.setData({ shown })
  },

  onKeyword(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
    this.applyFilter()
  },

  fmtJoined(value?: string) {
    return fmtDate(value)
  },

  fmtLast(value?: string) {
    return fmtDate(value)
  },
})
