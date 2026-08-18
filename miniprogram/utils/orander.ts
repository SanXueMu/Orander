// ========================================
// 类型定义
// ========================================

export type ThemeId = 'amber' | 'olive' | 'ink'
export type FontId = 'modern' | 'soft' | 'serif'
export type OrderStatus = 'submitted' | 'preparing' | 'completed' | 'cancelled'
export type SessionRole = 'visitor' | 'admin'

export interface Member {
  id: string
  nickname: string
  avatarUrl: string
  relation: string
  customRelation: string
  themeId: ThemeId
  fontId: FontId
  joinedAt: string
}

export interface Dish {
  id: string
  name: string
  category: string
  price: number
  description: string
  image: string
  tags: string[]
  featured: boolean
  soldOut: boolean
}

export interface CartItem {
  dishId: string
  quantity: number
}

export interface OrderItem {
  dishId: string
  name: string
  price: number
  quantity: number
  subtotal: number
  image: string
}

export interface Review {
  rating: number
  comment: string
  createdAt: string
}

export interface Order {
  id: string
  orderNumber: string
  memberId: string
  nickname: string
  relationLabel: string
  total: number
  note: string
  status: OrderStatus
  createdAt: string
  items: OrderItem[]
  review?: Review
}

export interface ContactCard extends Member {
  lastOrderAt: string
  ordersCount: number
}

export interface CartLine extends CartItem {
  dish: Dish
  subtotal: number
  coverStyle: string
}

export interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  navColor: string
  navBackground: string
  swatch: string[]
}

export interface FontOption {
  id: FontId
  name: string
  description: string
}

export interface PageLook {
  themeClass: string
  fontClass: string
  navColor: string
  navBackground: string
}

export interface SessionUser {
  role: SessionRole
  memberId?: string
  nickname: string
  avatarUrl: string
  loginCode: string
  loggedInAt: string
  adminToken?: string
}

// ========================================
// 常量与种子数据
// ========================================

const STORAGE_KEYS = {
  currentMember: 'orander-current-member',
  members: 'orander-members',
  dishes: 'orander-dishes',
  orders: 'orander-orders',
  cart: 'orander-cart',
  session: 'orander-session',
  lastOrderId: 'orander-last-order-id',
  lastCategory: 'orander-last-category',
}

export const DEFAULT_AVATAR_URL = ''

export const RELATION_OPTIONS = [
  '儿子',
  '女儿',
  '父',
  '妈',
  '伞兵',
  '大哥',
  '小姐姐',
  '铁柱',
  '二愣子',
  '自定义',
]

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'amber',
    name: '奶油白',
    description: '晨光奶油白，通透玻璃感的清爽餐桌。',
    navColor: '#17181C',
    navBackground: 'rgba(255,255,255,0.78)',
    swatch: ['#F5D5B8', '#F7CDB9', '#F0DFC8'],
  },
  {
    id: 'olive',
    name: '鼠尾草',
    description: '苔绿与亚麻色的呼吸感，像雨后的香草园。',
    navColor: '#17181C',
    navBackground: 'rgba(255,255,255,0.78)',
    swatch: ['#CFE0C4', '#C8DED8', '#E4E8D4'],
  },
  {
    id: 'ink',
    name: '午夜黑',
    description: '暖橙辉光落在午夜黑玻璃上，深夜小酒馆。',
    navColor: '#F2F4F8',
    navBackground: 'rgba(30,32,38,0.72)',
    swatch: ['#6B4128', '#5A3A22', '#8A5A36'],
  },
]

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: '利落清爽，适合主界面。',
  },
  {
    id: 'soft',
    name: 'Soft',
    description: '更松弛，像朋友家的菜单。',
  },
  {
    id: 'serif',
    name: 'Editorial',
    description: '更像一本精致账本。',
  },
]

const LEGACY_ASSET_MAP: Record<string, string> = {
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0': '',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80': '',
  'https://images.unsplash.com/photo-1496412705862-e0088f16f791?auto=format&fit=crop&w=900&q=80': '',
}

const SAMPLE_DISHES: Dish[] = [
  {
    id: 'sichuan-mapo-tofu',
    name: '麻婆豆腐',
    category: '川菜热菜',
    price: 32,
    description: '豆腐细嫩，花椒香气清晰，辣味落得稳，适合配米饭一起吃。',
    image: '',
    tags: ['下饭', '川味', '招牌'],
    featured: true,
    soldOut: false,
  },
  {
    id: 'cantonese-char-siu',
    name: '蜜汁叉烧',
    category: '粤菜烧味',
    price: 48,
    description: '边缘微焦，肉质软嫩，甜咸平衡，适合做一桌里的稳妥主菜。',
    image: '',
    tags: ['烧味', '微甜', '人气'],
    featured: true,
    soldOut: false,
  },
  {
    id: 'hunan-stir-fried-pork',
    name: '小炒黄牛肉',
    category: '湘菜热菜',
    price: 56,
    description: '牛肉滑嫩，青椒带一点冲劲，锅气明显，口味干净利落。',
    image: '',
    tags: ['鲜辣', '锅气'],
    featured: false,
    soldOut: false,
  },
  {
    id: 'jiangnan-braised-pork',
    name: '红烧肉',
    category: '江南家常',
    price: 46,
    description: '酱香偏醇厚，肥瘦层次分明，入口软糯但不腻口。',
    image: '',
    tags: ['家常', '软糯'],
    featured: false,
    soldOut: false,
  },
  {
    id: 'northern-tomato-egg',
    name: '番茄炒蛋',
    category: '家常小炒',
    price: 22,
    description: '酸甜清爽，鸡蛋松软，是很适合补一份平衡口味的家常菜。',
    image: '',
    tags: ['家常', '清爽'],
    featured: true,
    soldOut: false,
  },
  {
    id: 'old-beijing-plum-juice',
    name: '酸梅汤',
    category: '饮品小点',
    price: 12,
    description: '冰镇后口感更好，酸甜收口，适合搭配味道偏重的热菜。',
    image: '',
    tags: ['冰饮', '解腻'],
    featured: false,
    soldOut: false,
  },
]

const SAMPLE_MEMBERS: Member[] = [
  {
    id: 'member-iris',
    nickname: '小周',
    avatarUrl: DEFAULT_AVATAR_URL,
    relation: '访客',
    customRelation: '',
    themeId: 'amber',
    fontId: 'soft',
    joinedAt: '2026-04-18T19:30:00.000Z',
  },
  {
    id: 'member-stone',
    nickname: '阿文',
    avatarUrl: DEFAULT_AVATAR_URL,
    relation: '访客',
    customRelation: '',
    themeId: 'olive',
    fontId: 'modern',
    joinedAt: '2026-04-20T12:15:00.000Z',
  },
]

const SAMPLE_ORDERS: Order[] = [
  {
    id: 'order-sample-1',
    orderNumber: 'OR-24041801',
    memberId: 'member-iris',
    nickname: '小周',
    relationLabel: '访客',
    total: 44,
    note: '米饭一起上。',
    status: 'completed',
    createdAt: '2026-04-18T20:10:00.000Z',
    items: [
      {
        dishId: 'sichuan-mapo-tofu',
        name: '麻婆豆腐',
        price: 32,
        quantity: 1,
        subtotal: 32,
        image: SAMPLE_DISHES[0].image,
      },
      {
        dishId: 'old-beijing-plum-juice',
        name: '酸梅汤',
        price: 12,
        quantity: 1,
        subtotal: 12,
        image: SAMPLE_DISHES[5].image,
      },
    ],
    review: {
      rating: 5,
      comment: '豆腐很下饭，酸梅汤刚好解腻。',
      createdAt: '2026-04-18T21:05:00.000Z',
    },
  },
  {
    id: 'order-sample-2',
    orderNumber: 'OR-24042002',
    memberId: 'member-stone',
    nickname: '阿文',
    relationLabel: '访客',
    total: 102,
    note: '先上热菜。',
    status: 'submitted',
    createdAt: '2026-04-20T12:40:00.000Z',
    items: [
      {
        dishId: 'cantonese-char-siu',
        name: '蜜汁叉烧',
        price: 48,
        quantity: 1,
        subtotal: 48,
        image: SAMPLE_DISHES[1].image,
      },
      {
        dishId: 'jiangnan-braised-pork',
        name: '红烧肉',
        price: 46,
        quantity: 1,
        subtotal: 46,
        image: SAMPLE_DISHES[3].image,
      },
      {
        dishId: 'old-beijing-plum-juice',
        name: '酸梅汤',
        price: 12,
        quantity: 1,
        subtotal: 12,
        image: SAMPLE_DISHES[5].image,
      },
    ],
  },
]

const LEGACY_DISH_IDS = [
  'amber-braised-beef',
  'citrus-roast-chicken',
  'olive-butter-pasta',
  'hearth-potato-stack',
  'sea-salt-brulee',
  'midnight-plum-soda',
]

// ========================================
// 内部工具
// ========================================

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const hashString = (value: string) => {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }

  return result
}

const AVATAR_BACKGROUNDS = [
  'linear-gradient(135deg, #f2ab39 0%, #c9781a 100%)',
  'linear-gradient(135deg, #e4b660 0%, #69491a 100%)',
  'linear-gradient(135deg, #e88f6a 0%, #b85c3f 100%)',
  'linear-gradient(135deg, #9dbd8f 0%, #5f8a56 100%)',
]

const DISH_BACKGROUNDS = [
  'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
  'linear-gradient(135deg, #2a2a2a 0%, #6a6a6a 100%)',
  'linear-gradient(135deg, #050505 0%, #585858 100%)',
  'linear-gradient(135deg, #202020 0%, #8b8b8b 100%)',
  'linear-gradient(135deg, #111111 0%, #707070 100%)',
]

const normalizeAsset = (value: string) => {
  return LEGACY_ASSET_MAP[value] || value
}

export const getMonogram = (value: string, fallback = 'OR') => {
  const compact = value.replace(/\s+/g, '').trim()
  if (!compact) {
    return fallback
  }

  return compact.slice(0, 2).toUpperCase()
}

export const getAvatarStyle = (seed: string) => {
  const background = AVATAR_BACKGROUNDS[hashString(seed || 'orander') % AVATAR_BACKGROUNDS.length]
  return `background:${background};`
}

export const getDishCoverStyle = (seed: string) => {
  const background = DISH_BACKGROUNDS[hashString(seed || 'dish') % DISH_BACKGROUNDS.length]
  return `background:${background};`
}

const normalizeMember = (member: Member): Member => ({
  ...member,
  avatarUrl: normalizeAsset(member.avatarUrl || DEFAULT_AVATAR_URL),
})

const normalizeDish = (dish: Dish): Dish => ({
  ...dish,
  image: normalizeAsset(dish.image),
})

const normalizeOrder = (order: Order): Order => ({
  ...order,
  items: order.items.map((item) => ({
    ...item,
    image: normalizeAsset(item.image),
  })),
})

// ========================================
// 数据层 — Storage 读写
// ========================================

const readStorage = <T>(key: string, fallback: T): T => {
  const value = wx.getStorageSync(key)
  if (!value) {
    return clone(fallback)
  }

  return clone(value as T)
}

const writeStorage = <T>(key: string, value: T) => {
  wx.setStorageSync(key, clone(value))
}

const removeStorage = (key: string) => {
  wx.removeStorageSync(key)
}

const sortDishes = (dishes: Dish[]) => {
  return [...dishes].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1
    }

    if (left.category !== right.category) {
      return left.category.localeCompare(right.category, 'zh-Hans-CN')
    }

    return left.name.localeCompare(right.name)
  })
}

const sortOrders = (orders: Order[]) => {
  return [...orders].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

// ========================================
// 数据层 — 菜品缓存
// ========================================

let _dishCache: Dish[] | null = null
let _dishCacheDirty = true

const invalidateDishCache = () => {
  _dishCacheDirty = true
}

const getCachedDishes = (): Dish[] => {
  if (_dishCacheDirty || !_dishCache) {
    _dishCache = sortDishes(readStorage(STORAGE_KEYS.dishes, SAMPLE_DISHES))
    _dishCacheDirty = false
  }
  return _dishCache
}

export const ensureSeedData = () => {
  const storedDishes = wx.getStorageSync(STORAGE_KEYS.dishes)
  const storedMembers = wx.getStorageSync(STORAGE_KEYS.members)
  const storedOrders = wx.getStorageSync(STORAGE_KEYS.orders)
  const storedCurrentMember = wx.getStorageSync(STORAGE_KEYS.currentMember)
  let shouldResetSeedDishes = false

  if (!storedDishes) {
    writeStorage(STORAGE_KEYS.dishes, SAMPLE_DISHES)
  } else {
    const normalizedDishes = (storedDishes as Dish[]).map(normalizeDish)
    shouldResetSeedDishes = normalizedDishes.some((dish) => LEGACY_DISH_IDS.indexOf(dish.id) >= 0)
    writeStorage(STORAGE_KEYS.dishes, shouldResetSeedDishes ? SAMPLE_DISHES : normalizedDishes)
  }

  if (!storedMembers) {
    writeStorage(STORAGE_KEYS.members, SAMPLE_MEMBERS)
  } else {
    writeStorage(STORAGE_KEYS.members, (storedMembers as Member[]).map(normalizeMember))
  }

  if (!storedOrders) {
    writeStorage(STORAGE_KEYS.orders, SAMPLE_ORDERS)
  } else {
    const normalizedOrders = (storedOrders as Order[]).map(normalizeOrder)
    writeStorage(STORAGE_KEYS.orders, shouldResetSeedDishes ? SAMPLE_ORDERS : normalizedOrders)
  }

  if (storedCurrentMember) {
    writeStorage(STORAGE_KEYS.currentMember, normalizeMember(storedCurrentMember as Member))
  }

  const storedSession = wx.getStorageSync(STORAGE_KEYS.session)
  if (storedSession) {
    writeStorage(STORAGE_KEYS.session, storedSession as SessionUser)
  }

  invalidateDishCache()
}

export const getRelationLabel = (memberLike: Pick<Member, 'relation' | 'customRelation'>) => {
  if (memberLike.relation === '自定义' && memberLike.customRelation) {
    return memberLike.customRelation
  }

  return memberLike.relation
}

export const buildPageLook = (member: Member | null): PageLook => {
  const themeId = member ? member.themeId : 'amber'
  const fontId = member ? member.fontId : 'modern'
  const matchedTheme = THEME_OPTIONS.find((option) => option.id === themeId) || THEME_OPTIONS[0]

  return {
    themeClass: `theme-${matchedTheme.id}`,
    fontClass: `font-${fontId}`,
    navColor: matchedTheme.navColor,
    navBackground: matchedTheme.navBackground,
  }
}

export const getCurrentMember = () => {
  const member = wx.getStorageSync(STORAGE_KEYS.currentMember)
  if (!member) {
    return null
  }

  return clone(member as Member)
}

export const getSession = () => {
  const session = wx.getStorageSync(STORAGE_KEYS.session)
  if (!session) {
    return null
  }

  return clone(session as SessionUser)
}

export const isVisitorSession = () => {
  const session = getSession()
  return !!session && session.role === 'visitor'
}

export const isAdminSession = () => {
  const session = getSession()
  return !!session && session.role === 'admin'
}

export const getAdminToken = () => {
  const session = getSession()
  return session && session.role === 'admin' ? session.adminToken || '' : ''
}

/** 修改密码后同步云端返回的新 adminToken（= 新密码哈希），保持会话有效 */
export const updateAdminToken = (adminToken: string) => {
  const session = getSession()
  if (!session || session.role !== 'admin') {
    return
  }
  saveSession({ ...session, adminToken })
}

export const clearSession = (clearCurrentUser = false) => {
  removeStorage(STORAGE_KEYS.session)
  removeStorage(STORAGE_KEYS.lastOrderId)

  if (clearCurrentUser) {
    removeStorage(STORAGE_KEYS.currentMember)
    clearCart()
  }
}

export const verifyAdminPassword = (password: string) => {
  return password.trim().length > 0
}

export const saveSession = (session: SessionUser) => {
  writeStorage(STORAGE_KEYS.session, session)
  return session
}

const buildProfileIdentity = (profile?: Partial<WechatMiniprogram.UserInfo>, fallback = '访客') => {
  const nickName = profile ? profile.nickName || '' : ''
  const avatarUrl = profile ? profile.avatarUrl || DEFAULT_AVATAR_URL : DEFAULT_AVATAR_URL

  return {
    nickname: nickName.trim() || fallback,
    avatarUrl,
  }
}

export const loginVisitor = (profile?: Partial<WechatMiniprogram.UserInfo>, loginCode = '') => {
  const currentMember = getCurrentMember()
  const profileIdentity = profile
    ? buildProfileIdentity(profile, currentMember ? currentMember.nickname : `访客${getMembers().length + 1}`)
    : null
  const identity = currentMember
    ? {
        nickname: currentMember.nickname || (profileIdentity ? profileIdentity.nickname : `访客${getMembers().length + 1}`),
        avatarUrl: currentMember.avatarUrl || (profileIdentity ? profileIdentity.avatarUrl : DEFAULT_AVATAR_URL),
      }
    : profileIdentity || {
        nickname: `访客${getMembers().length + 1}`,
        avatarUrl: DEFAULT_AVATAR_URL,
      }

  const member = saveCurrentMember({
    nickname: identity.nickname,
    avatarUrl: identity.avatarUrl,
    relation: '访客',
    customRelation: '',
    themeId: 'amber',
    fontId: 'modern',
  })

  return saveSession({
    role: 'visitor',
    memberId: member.id,
    nickname: member.nickname,
    avatarUrl: member.avatarUrl,
    loginCode,
    loggedInAt: new Date().toISOString(),
  })
}

export const loginAdmin = (profile?: Partial<WechatMiniprogram.UserInfo>, loginCode = '', adminToken?: string) => {
  const identity = buildProfileIdentity(profile, 'Admin')

  return saveSession({
    role: 'admin',
    nickname: identity.nickname,
    avatarUrl: identity.avatarUrl,
    loginCode,
    loggedInAt: new Date().toISOString(),
    adminToken,
  })
}

export const saveLastOrderId = (orderId: string) => {
  writeStorage(STORAGE_KEYS.lastOrderId, orderId)
}

export const getLastOrderId = () => {
  const orderId = wx.getStorageSync(STORAGE_KEYS.lastOrderId)
  return orderId ? String(orderId) : ''
}

export const saveLastCategory = (category: string) => {
  writeStorage(STORAGE_KEYS.lastCategory, category)
}

export const getLastCategory = () => {
  const value = wx.getStorageSync(STORAGE_KEYS.lastCategory)
  return value ? String(value) : ''
}

export const getMembers = () => {
  const members = readStorage(STORAGE_KEYS.members, SAMPLE_MEMBERS)
  return members.sort((left, right) => {
    return new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime()
  })
}

export const replaceMembers = (members: Member[]) => {
  writeStorage(STORAGE_KEYS.members, members.map(normalizeMember))
}

export const saveMember = (member: Member, syncCurrent = false) => {
  const members = getMembers()
  const existingIndex = members.findIndex((item) => item.id === member.id)

  if (existingIndex >= 0) {
    members.splice(existingIndex, 1, member)
  } else {
    members.unshift(member)
  }

  writeStorage(STORAGE_KEYS.members, members)

  if (syncCurrent) {
    writeStorage(STORAGE_KEYS.currentMember, member)
  } else {
    const currentMember = getCurrentMember()
    if (currentMember && currentMember.id === member.id) {
      writeStorage(STORAGE_KEYS.currentMember, member)
    }
  }
}

export const deleteMember = (memberId: string) => {
  const members = getMembers().filter((member) => member.id !== memberId)
  writeStorage(STORAGE_KEYS.members, members)

  const orders = getOrders().filter((order) => order.memberId !== memberId)
  writeStorage(STORAGE_KEYS.orders, orders)

  const currentMember = getCurrentMember()
  if (currentMember && currentMember.id === memberId) {
    removeStorage(STORAGE_KEYS.currentMember)
  }

  const session = getSession()
  if (session && session.memberId === memberId) {
    removeStorage(STORAGE_KEYS.session)
  }
}

export const saveCurrentMember = (input: Omit<Member, 'id' | 'joinedAt'> & Partial<Pick<Member, 'id' | 'joinedAt'>>) => {
  const currentMember = getCurrentMember()
  const nextMember: Member = {
    id: currentMember ? currentMember.id : `member-${Date.now()}`,
    joinedAt: currentMember ? currentMember.joinedAt : new Date().toISOString(),
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
    relation: input.relation,
    customRelation: input.customRelation,
    themeId: input.themeId,
    fontId: input.fontId,
  }

  saveMember(nextMember, true)
  return nextMember
}

// ========================================
// 数据层 — 菜品 CRUD
// ========================================

export const getDishes = () => {
  return clone(getCachedDishes())
}

export const replaceDishes = (dishes: Dish[]) => {
  writeStorage(STORAGE_KEYS.dishes, dishes.map(normalizeDish))
  invalidateDishCache()
}

export const getMenuCategories = () => {
  const categories = new Set(getDishes().map((dish) => dish.category))
  return Array.from(categories)
}

export const saveDish = (dish: Dish) => {
  const dishes = getDishes()
  const existingIndex = dishes.findIndex((item) => item.id === dish.id)
  const nextDish = {
    ...dish,
    price: Number(dish.price.toFixed(2)),
    tags: dish.tags.filter((tag) => !!tag),
  }

  if (existingIndex >= 0) {
    dishes.splice(existingIndex, 1, nextDish)
  } else {
    dishes.unshift(nextDish)
  }

  writeStorage(STORAGE_KEYS.dishes, dishes)
  invalidateDishCache()
  return nextDish
}

export const deleteDish = (dishId: string) => {
  const dishes = getDishes().filter((dish) => dish.id !== dishId)
  writeStorage(STORAGE_KEYS.dishes, dishes)
  invalidateDishCache()
  removeFromCart(dishId)
}

export const updateDishAvailability = (dishId: string, soldOut: boolean) => {
  const dish = getDishes().find((item) => item.id === dishId)
  if (!dish) {
    return
  }

  saveDish({ ...dish, soldOut })
  invalidateDishCache()
}

// ========================================
// 数据层 — 购物车
// ========================================

export const getCart = () => {
  return readStorage<CartItem[]>(STORAGE_KEYS.cart, [])
}

export const MAX_CART_QUANTITY = 99

const clampQuantity = (quantity: number) => {
  return Math.min(MAX_CART_QUANTITY, Math.max(0, quantity))
}

export const addToCart = (dishId: string, quantity = 1) => {
  const cart = getCart()
  const currentIndex = cart.findIndex((item) => item.dishId === dishId)

  if (currentIndex >= 0) {
    cart[currentIndex].quantity = clampQuantity(cart[currentIndex].quantity + quantity)
  } else {
    cart.push({ dishId, quantity: clampQuantity(quantity) })
  }

  writeStorage(STORAGE_KEYS.cart, cart.filter((item) => item.quantity > 0))
}

export const setCartQuantity = (dishId: string, quantity: number) => {
  const cart = getCart()
  const currentIndex = cart.findIndex((item) => item.dishId === dishId)
  const nextQuantity = clampQuantity(quantity)

  if (currentIndex < 0 && nextQuantity > 0) {
    cart.push({ dishId, quantity: nextQuantity })
  } else if (currentIndex >= 0) {
    cart[currentIndex].quantity = nextQuantity
  }

  writeStorage(STORAGE_KEYS.cart, cart.filter((item) => item.quantity > 0))
}

export const removeFromCart = (dishId: string) => {
  const cart = getCart().filter((item) => item.dishId !== dishId)
  writeStorage(STORAGE_KEYS.cart, cart)
}

export const clearCart = () => {
  writeStorage(STORAGE_KEYS.cart, [])
}

export const cleanSoldOutFromCart = () => {
  const dishes = getDishes()
  const cart = getCart()
  const soldOutIds = new Set(dishes.filter((dish) => dish.soldOut).map((dish) => dish.id))
  const validIds = new Set(dishes.map((dish) => dish.id))
  const nextCart = cart.filter((item) => !soldOutIds.has(item.dishId) && validIds.has(item.dishId))

  if (nextCart.length !== cart.length) {
    writeStorage(STORAGE_KEYS.cart, nextCart)
    return cart.length - nextCart.length
  }

  return 0
}

export const buildCartLines = () => {
  const dishMap = new Map(getDishes().map((dish) => [dish.id, dish]))
  return getCart()
    .map((item) => {
      const dish = dishMap.get(item.dishId)
      if (!dish) {
        return null
      }

      return {
        ...item,
        dish,
        subtotal: Number((dish.price * item.quantity).toFixed(2)),
        coverStyle: getDishCoverStyle(dish.id),
      }
    })
    .filter((item): item is CartLine => item !== null)
}

export const getCartStats = () => {
  const cartLines = buildCartLines()
  const count = cartLines.reduce((result, line) => result + line.quantity, 0)
  const total = cartLines.reduce((result, line) => result + line.subtotal, 0)
  return {
    count,
    total: Number(total.toFixed(2)),
  }
}

// ========================================
// 数据层 — 订单
// ========================================

export const getOrders = () => {
  return sortOrders(readStorage(STORAGE_KEYS.orders, SAMPLE_ORDERS))
}

export const replaceOrders = (orders: Order[]) => {
  writeStorage(STORAGE_KEYS.orders, orders.map(normalizeOrder))
}

export const cacheOrder = (order: Order) => {
  const orders = getOrders()
  const orderIndex = orders.findIndex((item) => item.id === order.id)
  if (orderIndex >= 0) {
    orders.splice(orderIndex, 1, order)
  } else {
    orders.unshift(order)
  }

  replaceOrders(orders)
  saveLastOrderId(order.id)
  return order
}

export const getOrdersForCurrentMember = () => {
  const currentMember = getCurrentMember()
  if (!currentMember) {
    return []
  }

  return getOrders().filter((order) => order.memberId === currentMember.id)
}

export const getOrderById = (orderId: string) => {
  return getOrders().find((order) => order.id === orderId) || null
}

export const getOrdersByMemberId = (memberId: string) => {
  return getOrders().filter((order) => order.memberId === memberId)
}

export const createOrder = (note: string) => {
  const currentMember = getCurrentMember()
  const cartLines = buildCartLines()

  if (!currentMember || cartLines.length === 0) {
    return null
  }

  const createdAt = new Date().toISOString()
  const total = cartLines.reduce((result, line) => result + line.subtotal, 0)
  const order: Order = {
    id: `order-${Date.now()}`,
    orderNumber: `OR-${Date.now().toString().slice(-8)}`,
    memberId: currentMember.id,
    nickname: currentMember.nickname,
    relationLabel: getRelationLabel(currentMember),
    total: Number(total.toFixed(2)),
    note,
    status: 'submitted',
    createdAt,
    items: cartLines.map((line) => ({
      dishId: line.dish.id,
      name: line.dish.name,
      price: line.dish.price,
      quantity: line.quantity,
      subtotal: line.subtotal,
      image: line.dish.image,
    })),
  }

  const orders = getOrders()
  orders.unshift(order)
  writeStorage(STORAGE_KEYS.orders, orders)
  saveLastOrderId(order.id)
  clearCart()
  return order
}

export const saveReview = (orderId: string, rating: number, comment: string) => {
  const orders = getOrders()
  const orderIndex = orders.findIndex((order) => order.id === orderId)
  if (orderIndex < 0) {
    return null
  }

  const order = orders[orderIndex]
  const nextOrder: Order = {
    ...order,
    review: {
      rating,
      comment,
      createdAt: new Date().toISOString(),
    },
  }

  orders.splice(orderIndex, 1, nextOrder)
  writeStorage(STORAGE_KEYS.orders, orders)
  return nextOrder
}

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
  const orders = getOrders()
  const orderIndex = orders.findIndex((order) => order.id === orderId)
  if (orderIndex < 0) {
    return null
  }

  const nextOrder: Order = {
    ...orders[orderIndex],
    status,
  }

  orders.splice(orderIndex, 1, nextOrder)
  writeStorage(STORAGE_KEYS.orders, orders)
  return nextOrder
}

// ========================================
// 视图工具
// ========================================

export const formatMoney = (amount: number) => {
  return `¥${amount.toFixed(2)}`
}

export const formatShortDate = (value: string) => {
  const date = new Date(value)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

export const formatReceiptDate = (value: string) => {
  const date = new Date(value)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getContactCards = () => {
  const members = getMembers()
  const orders = getOrders()

  return members.map((member) => {
    const memberOrders = orders.filter((order) => order.memberId === member.id)
    const latestOrder = memberOrders[0]

    return {
      ...member,
      lastOrderAt: latestOrder ? latestOrder.createdAt : member.joinedAt,
      ordersCount: memberOrders.length,
    }
  })
}
