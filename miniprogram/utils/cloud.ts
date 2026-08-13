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
  | 'updateOrderStatus'
  | 'createOrder'

interface CloudEnvelope<T> {
  ok: boolean
  data: T
  message?: string
}

export const CLOUD_SYNC_ENABLED = true

let cloudReady = false

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
      env: 'DYNAMIC_CURRENT_ENV',
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
  if (!canUseCloud()) {
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
      console.warn('cloud function failed', action, message)
      return null
    }

    return envelope.data
  } catch (error) {
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
