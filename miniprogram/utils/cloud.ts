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

type OranderAction = string

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

/* 单菜品发布：本地图先传云存储，再 upsert 云端（admin-dish 保存即发布） */
export const publishSingleDish = async (dish: Dish, adminToken: string) => {
  if (!canUseCloud()) {
    return null
  }

  const cloudImage = await resolveCloudImagePath(dish)
  const nextDish = cloudImage === dish.image ? dish : { ...dish, image: cloudImage }
  const savedDish = await saveDishCloud(nextDish, adminToken)
  if (savedDish) {
    saveDishLocalImage(dish.id, cloudImage)
  }
  return savedDish
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

/* 云存储 fileID 回写本地菜品缓存（避免每次发布重复上传） */
const saveDishLocalImage = (dishId: string, cloudImage: string) => {
  if (!cloudImage || cloudImage.indexOf('cloud://') !== 0) {
    return
  }
  const localDish = getDishes().find((item) => item.id === dishId)
  if (localDish && localDish.image !== cloudImage) {
    saveDish({ ...localDish, image: cloudImage })
  }
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
    visitors?: number
    dishes?: number
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

/* ========================================
 * 喜茶GO 复刻 · 新域接口（R2 核心交易）
 * ======================================== */

import type { CatalogCategory, FulfillMode, Spu, StoreInfo } from './xicha'

export interface CloudOrderItem {
  name: string
  price: number
  quantity: number
  image?: string
}

/** 新版订单（服务端计价/状态机）：字段与旧 Order 兼容 + 扩展 */
export interface XiOrder {
  id: string
  orderNumber: string
  memberId: string
  nickname: string
  relationLabel: string
  total: number
  note: string
  status: string
  createdAt: string
  items: CloudOrderItem[]
  review?: { rating: number; comment: string; createdAt: string }
  biz?: 'TEA' | 'MALL'
  fulfillMode?: FulfillMode
  storeId?: string
  storeName?: string
  queueNo?: number
  pricedItems?: Array<{ spuId: string; name: string; unitPrice: number; quantity: number; subtotal: number; image?: string; selections: Array<{ groupName: string; optionName: string }> }>
  pickupCode?: string
}

export const fetchCatalogCloud = async () => {
  return callOrander<{ categories: CatalogCategory[]; spus: Spu[] }>('getProductCatalog')
}

export const fetchStoresCloud = async (params: { latitude?: number; longitude?: number } = {}) => {
  return callOrander<{ stores: StoreInfo[] }>('getStores', params)
}

export interface PreviewPayload {
  storeId: string
  mode: FulfillMode
  items: Array<{ spuId: string; qty: number; selections: Array<{ groupId: string; optionId: string }> }>
}

export const previewOrderCloud = async (payload: PreviewPayload) => {
  return callOrander<{
    itemsTotal: number
    deliveryFee: number
    packagingFee: number
    discount: number
    payable: number
    lines: XiOrder['pricedItems']
  }>('previewOrder', payload as unknown as Record<string, unknown>)
}

export interface CreateOrderV2Payload {
  storeId?: string
  biz?: 'TEA' | 'MALL'
  mode: FulfillMode
  note?: string
  couponInstanceId?: string
  items: PreviewPayload['items']
}

export const createOrderV2Cloud = async (payload: CreateOrderV2Payload) => {
  return callOrander<XiOrder>('createOrderV2', payload as unknown as Record<string, unknown>)
}

export const payOrderCloud = async (orderId: string) => {
  return callOrander<XiOrder>('payOrder', { orderId })
}

export const cancelOrderV2Cloud = async (orderId: string) => {
  return callOrander<XiOrder>('cancelOrder', { orderId })
}

export const refundApplyCloud = async (orderId: string, reason: string) => {
  return callOrander<XiOrder>('refundApply', { orderId, reason })
}

export const getMyOrdersV2Cloud = async (page = 1, pageSize = 20) => {
  return callOrander<PaginatedOrders>('getMyOrders', { page, pageSize })
}

/* ============ R3 会员 / 营销域（promotion + member） ============ */

export interface LevelCard {
  level: string
  name: string
  threshold: number
  perk: string
}

export interface MemberProfile {
  id?: string
  nickname?: string
  avatarUrl?: string
  growthValue?: number
  levelName?: string
  levelPerk?: string
  nextLevel?: string | null
  nextGap?: number
  levels?: LevelCard[]
}

export const getMemberProfileCloud = () =>
  callOrander<MemberProfile>('getMemberProfile', {})

export const getLevelCardsCloud = () => callOrander<{ items?: LevelCard[] } | LevelCard[]>('getLevelCards', {})

export interface AssetCoupon {
  id: string
  name: string
  type?: string
  value?: number
  threshold?: number
  status: 'UNUSED' | 'USED' | 'EXPIRED' | string
  expiresAt?: string
  issuedAt?: string
}

export interface MemberAssets {
  coupons: AssetCoupon[]
  cards: Array<Record<string, unknown>>
  wallet: number
  points: number
}

export const listAssetsCloud = () => callOrander<MemberAssets>('listAssets', {})

export const listCouponTemplatesCloud = () =>
  callOrander<{ items: Array<{ id: string; name: string; type?: string; value?: number; threshold?: number; status?: string }> }>('listCouponTemplates', {})

export const receiveCouponCloud = (templateId: string) =>
  callOrander<AssetCoupon>('receiveCoupon', { templateId })

export const redeemCodeCloud = (code: string) =>
  callOrander<{ rewardType: string; rewardValue: unknown }>('redeemCode', { code })

export const redeemCardCloud = (cardNo: string, activeCode: string) =>
  callOrander<{ cardNo: string; name: string }>('redeemCard', { cardNo, activeCode })

export interface BenefitItem {
  code: string
  name: string
  description?: string
  status?: string
}

export const listBenefitsCloud = () =>
  callOrander<{ items: BenefitItem[]; claimed: Array<{ code: string; at: string }> }>('listBenefits', {})

export const claimBenefitCloud = (code: string) =>
  callOrander<{ code: string; ok: boolean }>('claimBenefit', { code })

export interface PointsFlow {
  id: string
  delta: number
  reason?: string
  at: string
}

export const listPointsFlowCloud = () => callOrander<{ items: PointsFlow[] }>('listPointsFlow', {})

/* ============ R4 百货 + 内容域 ============ */

export interface MallProduct {
  id: string
  name: string
  floor: string
  floorName: string
  price: number
  originalPrice: number
  image: string
  stock: number
  soldCount: number
}

export const getMallFloorsCloud = () =>
  callOrander<{ products: MallProduct[] }>('getMallFloors', {})

export type ActivityTemplate = 'NEW_PRODUCT' | 'ANNIVERSARY' | 'SELLING_POINT' | 'INVITE_MEMBER' | 'GENERIC'

export interface HomeActivity {
  id: string
  template: ActivityTemplate | string
  title: string
  subtitle?: string
  image?: string
}

export const getHomeActivitiesCloud = () =>
  callOrander<{ activities: HomeActivity[] }>('getHomeActivities', {})

/* ============ R5 外围域 ============ */

export const submitReviewCloud = (payload: { orderId: string; rating: number; content?: string }) =>
  callOrander<Record<string, unknown>>('submitReview', payload)

export const listMyReviewsCloud = () => callOrander<{ items: unknown[] }>('listMyReviews', {})

export const csCreateSessionCloud = () =>
  callOrander<{ id: string }>('createSession', {})
export const csListMySessionsCloud = () =>
  callOrander<{ items: Array<{ id: string; status: string }> }>('listMySessions', {})
export const csGetMessagesCloud = (sessionId: string) =>
  callOrander<{ messages: CsMessage[] }>('getMessages', { sessionId })
export const csSendMessageCloud = (payload: { sessionId: string; text?: string; image?: string }) =>
  callOrander<{ message: CsMessage }>('sendMessage', payload)
export interface CsMessage {
  id: string
  from: 'USER' | 'SYSTEM' | 'ADMIN'
  type: 'text' | 'image'
  text?: string
  image?: string
  createdAt: string
}

export const gmGetSlotsCloud = (date: string) =>
  callOrander<{ date: string; slots: Array<{ id: string; label?: string; startTime?: string; endTime?: string; capacity: number; reserved: number; remaining: number }> }>('getSlots', { date })
export const gmReserveSlotCloud = (payload: { slotId: string; date: string; headcount: number; contactName?: string; phone?: string; note?: string }) =>
  callOrander<Record<string, unknown>>('reserveSlot', payload)
export const gmMyReservationsCloud = () => callOrander<{ items: unknown[] }>('myReservations', {})

export interface TitleRecord {
  id: string
  name: string
  taxNo?: string
}
export const invListTitlesCloud = () => callOrander<{ items: TitleRecord[] }>('listTitles', {})
export const invSaveTitleCloud = (payload: { id?: string; name: string; taxNo?: string }) =>
  callOrander<TitleRecord>('saveTitle', payload)
export const invDeleteTitleCloud = (id: string) => callOrander<Record<string, unknown>>('deleteTitle', { id })
export const invListOrdersCloud = () =>
  callOrander<{ items: Array<{ id: string; orderNumber: string; payAmount: number; createdAt?: string }> }>('listInvoicableOrders', {})
export const invApplyCloud = (payload: Record<string, unknown>) => callOrander<Record<string, unknown>>('applyInvoice', payload)
export const invListRecordsCloud = () => callOrander<{ items: unknown[] }>('listInvoiceRecords', {})

export const notifyListCloud = () =>
  callOrander<{ items: Array<{ id: string; title: string; content?: string; read?: boolean; createdAt?: string }>; unread: number }>('listNotifications', {})
export const notifyMarkReadCloud = (id: string) => callOrander<Record<string, unknown>>('markRead', { id })
export const notifyMarkAllReadCloud = () => callOrander<Record<string, unknown>>('markAllRead', {})

export const getPoliciesCloud = () =>
  callOrander<{ items: Array<{ id: string; title: string; version?: string; updatedAt?: string }> }>('getPolicies', {})
export const getPolicyCloud = (policyId: string) =>
  callOrander<{ id: string; title: string; version?: string; sections?: unknown[]; contentHtml?: string; updatedAt?: string }>('getPolicy', { policyId })
