import { fetchCloudMemberOrders, initCloud, updateCloudOrderStatus } from '../../utils/cloud'
import { formatMoney, formatShortDate, getAdminToken, getAvatarStyle, getMembers, getMonogram, getOrdersByMemberId, isAdminSession, updateOrderStatus } from '../../utils/orander'
import { pageLookBehavior } from '../../behaviors/page-look'
import type { Order } from '../../utils/orander'

const mapOrderRows = (orders: Order[]) => {
  return orders.map((order) => ({
    ...order,
    totalText: formatMoney(order.total),
    createdText: formatShortDate(order.createdAt),
    statusText: order.status === 'completed' ? '已完成' : '进行中',
    canComplete: order.status !== 'completed',
    itemsText: order.items.map((item) => item.name).join(' / '),
  }))
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    avatarUrl: '',
    showAvatarImage: false,
    avatarLabel: 'OR',
    avatarStyle: getAvatarStyle('member'),
    memberId: '',
    nickname: '',
    relationLabel: '',
    orders: [] as ReturnType<typeof mapOrderRows>,
  },

  async onLoad(options: Record<string, string>) {
    if (!isAdminSession()) {
      wx.reLaunch({
        url: '/pages/profile-edit/index',
      })
      return
    }

    const memberId = options.id || ''
    const member = getMembers().find((item) => item.id === memberId)
    if (!member) {
      wx.showToast({
        title: '用户不存在',
        icon: 'none',
      })
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 400)
      return
    }

    this.setData({
      memberId,
      avatarUrl: member.avatarUrl,
      showAvatarImage: !!member.avatarUrl,
      avatarLabel: getMonogram(member.nickname, 'OR'),
      avatarStyle: getAvatarStyle(member.nickname),
      nickname: member.nickname,
      relationLabel: member.customRelation || member.relation,
    })

    await this.refreshOrders(memberId)
  },

  async refreshOrders(memberId: string) {
    let orders = getOrdersByMemberId(memberId)
    if (initCloud()) {
      const remoteOrders = await fetchCloudMemberOrders(memberId)
      if (remoteOrders) {
        orders = remoteOrders
      }
    }

    this.setData({
      orders: mapOrderRows(orders),
    })
  },

  completeOrder(event: WechatMiniprogram.BaseEvent) {
    const orderId = event.currentTarget.dataset.id as string
    if (!orderId) {
      return
    }

    wx.showModal({
      title: '完成订单',
      content: '确认将该订单标记为已完成？',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        const order = updateOrderStatus(orderId, 'completed')
        if (!order) {
          wx.showToast({
            title: '订单不存在',
            icon: 'none',
          })
          return
        }

        if (initCloud()) {
          await updateCloudOrderStatus(orderId, 'completed', getAdminToken())
        }

        await this.refreshOrders(this.data.memberId)
        wx.showToast({
          title: '已完成',
          icon: 'success',
        })
      },
    })
  },
})
