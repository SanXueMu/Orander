const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

const collections = {
  dishes: db.collection('dishes'),
  members: db.collection('members'),
  orders: db.collection('orders'),
  config: db.collection('config'),
}

const ADMIN_PASSWORD_KEY = 'adminPassword'
const DEFAULT_ADMIN_PASSWORD = 'orander2026'

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(`orander-salt::${password}`).digest('hex')
}

const ensureAdminConfig = async () => {
  const existing = await collections.config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  if (existing.data.length === 0) {
    await collections.config.add({
      data: {
        key: ADMIN_PASSWORD_KEY,
        value: hashPassword(DEFAULT_ADMIN_PASSWORD),
        updatedAt: new Date().toISOString(),
      },
    })
  }

  const result = await collections.config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  return result.data[0].value
}

const verifyAdmin = async ({ password = '' }) => {
  const storedHash = await ensureAdminConfig()
  if (hashPassword(password) !== storedHash) {
    throw new Error('密码错误')
  }

  return { adminToken: storedHash }
}

const changeAdminPassword = async ({ adminToken = '', newPassword = '' }) => {
  const storedHash = await ensureAdminConfig()
  if (adminToken !== storedHash) {
    throw new Error('未授权')
  }

  if (!newPassword.trim()) {
    throw new Error('密码不能为空')
  }

  const newHash = hashPassword(newPassword)
  await collections.config.where({ key: ADMIN_PASSWORD_KEY }).update({
    data: { value: newHash, updatedAt: new Date().toISOString() },
  })

  return { adminToken: newHash }
}

const requireAdmin = (event) => {
  if (!event.adminToken || event.adminToken !== event._expectedAdminToken) {
    throw new Error('未授权的管理操作')
  }
}

const mapDish = (doc = {}) => ({
  id: doc.id,
  name: doc.name || '',
  category: doc.category || '',
  price: Number(doc.price || 0),
  description: doc.description || '',
  image: doc.image || '',
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  featured: !!doc.featured,
  soldOut: !!doc.soldOut,
})

const mapMember = (doc = {}) => ({
  id: doc.id,
  nickname: doc.nickname || '',
  avatarUrl: doc.avatarUrl || '',
  relation: doc.relation || '访客',
  customRelation: doc.customRelation || '',
  themeId: doc.themeId || 'amber',
  fontId: doc.fontId || 'modern',
  joinedAt: doc.joinedAt || new Date().toISOString(),
})

const mapOrder = (doc = {}) => ({
  id: doc.id,
  orderNumber: doc.orderNumber,
  memberId: doc.memberId,
  nickname: doc.nickname,
  relationLabel: doc.relationLabel,
  total: Number(doc.total || 0),
  note: doc.note || '',
  status: doc.status || 'submitted',
  createdAt: doc.createdAt,
  items: Array.isArray(doc.items) ? doc.items : [],
  review: doc.review,
})

const sortDishes = (dishes) => {
  return [...dishes].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1
    }

    if (left.category !== right.category) {
      return String(left.category).localeCompare(String(right.category), 'zh-Hans-CN')
    }

    return String(left.name).localeCompare(right.name)
  })
}

const sortMembers = (members) => {
  return [...members].sort((left, right) => {
    return new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime()
  })
}

const ok = (data) => ({ ok: true, data })
const fail = (message) => ({ ok: false, data: null, message })

const log = (action, message) => {
  console.log(`[orander:${action}] ${message}`)
}

const fetchDishes = async () => {
  const result = await collections.dishes.limit(100).get()
  return sortDishes(result.data.map(mapDish))
}

const ensureSeedDishes = async (dishes = []) => {
  const existing = await collections.dishes.limit(1).get()
  if (existing.data.length === 0 && dishes.length) {
    await Promise.all(
      dishes.map((dish) => collections.dishes.add({
        data: {
          ...mapDish(dish),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })),
    )
  }

  return fetchDishes()
}

const syncVisitor = async ({ nickname = '', avatarUrl = '' }) => {
  const { OPENID } = cloud.getWXContext()
  const memberId = `member-${OPENID}`
  const current = await collections.members.where({ id: memberId }).limit(1).get()
  const nextMember = {
    id: memberId,
    openId: OPENID,
    nickname: nickname || '访客',
    avatarUrl: avatarUrl || '',
    relation: '访客',
    customRelation: '',
    themeId: 'amber',
    fontId: 'modern',
    joinedAt: current.data.length ? current.data[0].joinedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (current.data.length) {
    await collections.members.where({ id: memberId }).update({ data: nextMember })
  } else {
    await collections.members.add({ data: nextMember })
  }

  return mapMember(nextMember)
}

const saveDish = async (dish) => {
  const nextDish = {
    ...mapDish(dish),
    updatedAt: new Date().toISOString(),
  }

  const current = await collections.dishes.where({ id: nextDish.id }).limit(1).get()
  if (current.data.length) {
    await collections.dishes.where({ id: nextDish.id }).update({ data: nextDish })
  } else {
    await collections.dishes.add({
      data: {
        ...nextDish,
        createdAt: new Date().toISOString(),
      },
    })
  }

  return mapDish(nextDish)
}

const deleteDish = async (dishId) => {
  await collections.dishes.where({ id: dishId }).remove()
  return { id: dishId }
}

const deleteMember = async (memberId) => {
  await Promise.all([
    collections.members.where({ id: memberId }).remove(),
    collections.orders.where({ memberId }).remove(),
  ])

  return { id: memberId }
}

const listMembers = async () => {
  const [memberResult, orderResult] = await Promise.all([
    collections.members.limit(100).get(),
    collections.orders.limit(200).get(),
  ])

  const orders = orderResult.data.map(mapOrder)

  return sortMembers(memberResult.data.map(mapMember)).map((member) => {
    const relatedOrders = orders.filter((order) => order.memberId === member.id)
    const latestOrder = relatedOrders.sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })[0]

    return {
      ...member,
      ordersCount: relatedOrders.length,
      lastOrderAt: latestOrder ? latestOrder.createdAt : member.joinedAt,
    }
  })
}

const createOrder = async (payload) => {
  const createdAt = new Date().toISOString()
  const order = {
    id: `order-${Date.now()}`,
    orderNumber: `OR-${Date.now().toString().slice(-8)}`,
    memberId: payload.memberId,
    nickname: payload.nickname,
    relationLabel: payload.relationLabel,
    total: Number(payload.total || 0),
    note: payload.note || '',
    status: 'submitted',
    createdAt,
    items: Array.isArray(payload.items) ? payload.items : [],
  }

  await collections.orders.add({ data: order })
  return mapOrder(order)
}

const listMemberOrders = async (memberId) => {
  const result = await collections.orders.where({ memberId }).limit(200).get()
  return result.data.map(mapOrder).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

const updateOrderStatus = async (orderId, status) => {
  const nextStatus = status === 'completed' ? 'completed' : 'submitted'
  await collections.orders.where({ id: orderId }).update({
    data: { status: nextStatus },
  })

  const result = await collections.orders.where({ id: orderId }).limit(1).get()
  return mapOrder(result.data[0])
}

exports.main = async (event = {}) => {
  const { action } = event

  try {
    switch (action) {
      case 'verifyAdmin': {
        log(action, 'password check')
        return ok(await verifyAdmin(event))
      }

      case 'changeAdminPassword': {
        log(action, 'password change')
        return ok(await changeAdminPassword(event))
      }

      case 'bootstrap': {
        log(action, 'seed dishes')
        return ok(await ensureSeedDishes(event.dishes || []))
      }

      case 'syncVisitor': {
        log(action, `visitor ${event.nickname || ''}`)
        return ok(await syncVisitor(event))
      }

      case 'listDishes': {
        return ok(await fetchDishes())
      }

      case 'saveDish': {
        const config = await ensureAdminConfig()
        if (event.adminToken !== config) {
          return fail('未授权的管理操作')
        }
        log(action, `dish ${event.dish ? event.dish.id : ''}`)
        return ok(await saveDish(event.dish || {}))
      }

      case 'deleteDish': {
        const config = await ensureAdminConfig()
        if (event.adminToken !== config) {
          return fail('未授权的管理操作')
        }
        log(action, `dish ${event.dishId}`)
        return ok(await deleteDish(event.dishId))
      }

      case 'listMembers': {
        return ok(await listMembers())
      }

      case 'deleteMember': {
        const config = await ensureAdminConfig()
        if (event.adminToken !== config) {
          return fail('未授权的管理操作')
        }
        log(action, `member ${event.memberId}`)
        return ok(await deleteMember(event.memberId))
      }

      case 'listMemberOrders': {
        return ok(await listMemberOrders(event.memberId))
      }

      case 'updateOrderStatus': {
        const config = await ensureAdminConfig()
        if (event.adminToken !== config) {
          return fail('未授权的管理操作')
        }
        log(action, `order ${event.orderId} -> ${event.status}`)
        return ok(await updateOrderStatus(event.orderId, event.status))
      }

      case 'createOrder': {
        log(action, `member ${event.memberId}`)
        return ok(await createOrder(event))
      }

      default:
        return fail('unknown action')
    }
  } catch (error) {
    log(action, `error: ${error.message}`)
    return fail(error.message || 'cloud error')
  }
}
