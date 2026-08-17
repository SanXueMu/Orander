import {
  cacheOrder,
  getDishes,
  getSession,
  replaceDishes,
  replaceMembers,
  saveDish,
  saveMember,
  saveSession,
} from './orander'
import type { ContactCard, Dish, Member, Order, OrderItem } from './orander'

type OranderAction =
  | 'verifyAdmin'
  | 'changeAdminPassword'
  | 'bootstrap'
  | 'syncVisitor'
  | 'listDishes'
  | 'saveDish'
  | 'deleteDish'
  | 'listMembers'
  | 'deleteMember'
  | 'listMemberOrders'
  | 'listAllOrders'
  | 'updateOrderStatus'
  | 'createOrder'
  | 'getBusinessStatus'
  | 'setBusinessStatus'
  | 'getOrderStats'

interface CloudEnvelope<T> {
  ok: boolean
  data: T
  message?: string
}

export const CLOUD_SYNC_ENABLED = true

let cloudReady = false
let lastCloudError = ''

/** 最近一次云函数调用失败的原因（区分"密码错误"与"调用失败"，如云函数未部署新版本） */
export const getLastCloudError = () => lastCloudError

export const initCloud = (force = false) => {
  if (!force && !CLOUD_SYNC_ENABLED) {
    return false
  }

  if (cloudReady || typeof wx.cloud === 'undefined') {
    return cloudReady
  }

  try {
    wx.cloud.init({
      traceUser: true,
      /* 小程序端必须用真实环境 ID（DYNAMIC_CURRENT_ENV 仅云函数端有效） */
      env: 'cloud1-d7guohsipf7e4d5a5',
    })
    cloudReady = true
  } catch (error) {
    console.warn('cloud init failed', error)
    cloudReady = false
  }

  return cloudReady
}

export const canUseCloud = () => {
  return cloudReady && typeof wx.cloud !== 'undefined'
}

const callOrander = async <T>(action: OranderAction, payload: Record<string, unknown> = {}) => {
  lastCloudError = ''
  if (!canUseCloud()) {
    lastCloudError = '云能力未初始化'
    return null
  }

  try {
    const result = await wx.cloud.callFunction({
      name: 'orander',
      data: {
        action,
        ...payload,
      },
    })

    const envelope = result.result as CloudEnvelope<T>
    if (!envelope || !envelope.ok) {
      const message = envelope ? envelope.message : ''
      lastCloudError = message || '云函数返回异常（可能云端仍是旧版本，请在开发者工具重新部署）'
      console.warn('cloud function failed', action, message)
      return null
    }

    return envelope.data
  } catch (error) {
    lastCloudError = '云函数调用失败（可能未部署或网络异常）'
    console.warn('cloud call error', action, error)
    return null
  }
}

export const verifyAdminCloud = async (password: string) => {
  return callOrander<{ adminToken: string }>('verifyAdmin', { password })
}

export const changeAdminPasswordCloud = async (adminToken: string, newPassword: string) => {
  return callOrander<{ adminToken: string }>('changeAdminPassword', { adminToken, newPassword })
}

export const bootstrapCloudMenu = async () => {
  const dishes = await callOrander<Dish[]>('bootstrap', {
    dishes: getDishes(),
  })

  if (dishes) {
    replaceDishes(dishes)
  }

  return dishes
}

export const syncVisitorMemberCloud = async (payload: {
  nickname: string
  avatarUrl: string
  loginCode: string
}) => {
  const member = await callOrander<Member>('syncVisitor', payload)
  if (!member) {
    return null
  }

  saveMember(member, true)
  const session = getSession()
  if (session) {
    saveSession({
      ...session,
      memberId: member.id,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
    })
  }

  return member
}

export const fetchCloudDishes = async () => {
  const dishes = await callOrander<Dish[]>('listDishes')
  if (dishes) {
    replaceDishes(dishes)
  }

  return dishes
}

export const saveDishCloud = async (dish: Dish, adminToken: string) => {
  return callOrander<Dish>('saveDish', { dish, adminToken })
}

const resolveCloudImagePath = async (dish: Dish) => {
  const image = dish.image || ''
  if (!image || image.indexOf('cloud://') === 0 || !canUseCloud()) {
    return image
  }

  const extensionMatch = image.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  const extension = extensionMatch ? extensionMatch[1] : 'jpg'
  const result = await wx.cloud.uploadFile({
    cloudPath: `orander/dishes/${dish.id}-${Date.now()}.${extension}`,
    filePath: image,
  }) as { fileID?: string }

  return result.fileID || image
}

export const publishLocalDishesToCloud = async (adminToken: string) => {
  if (!canUseCloud()) {
    return null
  }

  const localDishes = getDishes()
  const publishedDishes: Dish[] = []

  for (const dish of localDishes) {
    const cloudImage = await resolveCloudImagePath(dish)
    const nextDish = cloudImage === dish.image ? dish : saveDish({
      ...dish,
      image: cloudImage,
    })

    const savedDish = await saveDishCloud(nextDish, adminToken)
    if (savedDish) {
      publishedDishes.push(savedDish)
    }
  }

  await fetchCloudDishes()
  return publishedDishes
}

export const deleteDishCloud = async (dishId: string, adminToken: string) => {
  const result = await callOrander<{ id: string }>('deleteDish', { dishId, adminToken })
  return !!result
}

export const fetchCloudMembers = async () => {
  const members = await callOrander<ContactCard[]>('listMembers')
  if (members) {
    replaceMembers(
      members.map(({ ordersCount: _ordersCount, lastOrderAt: _lastOrderAt, ...member }) => member),
    )
  }

  return members
}

export const deleteMemberCloud = async (memberId: string, adminToken: string) => {
  const result = await callOrander<{ id: string }>('deleteMember', { memberId, adminToken })
  return !!result
}

export const fetchCloudMemberOrders = async (memberId: string) => {
  return callOrander<Order[]>('listMemberOrders', { memberId })
}

export const updateCloudOrderStatus = async (orderId: string, status: 'submitted' | 'completed', adminToken: string) => {
  const order = await callOrander<Order>('updateOrderStatus', { orderId, status, adminToken })
  if (order) {
    cacheOrder(order)
  }

  return order
}

export const createCloudOrder = async (payload: {
  memberId: string
  nickname: string
  relationLabel: string
  total: number
  note: string
  items: OrderItem[]
}) => {
  const order = await callOrander<Order>('createOrder', payload)
  if (order) {
    cacheOrder(order)
  }

  return order
}

export interface PaginatedOrders {
  items: Order[]
  total: number
  page: number
  pageSize: number
}

export interface BusinessStatus {
  open: boolean
  chefName?: string
}

export interface OrderStats {
  totalOrders: number
  completedCount: number
  submittedCount: number
  revenue: number
  today?: {
    orders: number
    revenue: number
    submitted: number
  }
  daily?: Array<{
    date: string
    orders: number
    revenue: number
  }>
  topDishes: Array<{
    dishId: string
    name: string
    quantity: number
    revenue: number
  }>
}

export const listAllOrdersCloud = async (page = 1, pageSize = 20) => {
  return callOrander<PaginatedOrders>('listAllOrders', { page, pageSize })
}

export const getBusinessStatusCloud = async () => {
  return callOrander<BusinessStatus>('getBusinessStatus')
}

export const setBusinessStatusCloud = async (open: boolean, adminToken: string, chefName?: string) => {
  return callOrander<BusinessStatus>('setBusinessStatus', { open, adminToken, chefName })
}

export const getOrderStatsCloud = async () => {
  return callOrander<OrderStats>('getOrderStats')
}
