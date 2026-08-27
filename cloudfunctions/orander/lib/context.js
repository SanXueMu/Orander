/**
 * 共享上下文：db 句柄 / 工具函数 / 集合自动初始化
 * 各域模块 require 此文件，不直接触碰 wx-server-sdk
 */
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

/* 全部集合（新旧并存：dishes/members/orders/config 为旧集合，R2-R7 逐步迁移） */
const COLLECTION_NAMES = [
  'dishes', 'members', 'orders', 'config',
  'categories', 'spus', 'stores', 'store_menus', 'payments', 'refunds',
  'coupons', 'coupon_instances', 'codes', 'paid_cards', 'benefit_grants',
  'points_flows', 'wallets', 'mall_products', 'reviews',
  'cs_sessions', 'kb_docs', 'invoices', 'invoice_titles',
  'notifications', 'activities', 'banners', 'policies',
  'gm_slots', 'gm_reservations', 'audit_logs', 'counters',
]

let collectionsReady = false
const ensureCollections = async () => {
  if (collectionsReady) {
    return
  }
  for (const name of COLLECTION_NAMES) {
    try {
      await db.createCollection(name)
      log('init', `collection created: ${name}`)
    } catch (error) {
      /* 已存在（-501001/duplicate）直接跳过 */
    }
  }
  collectionsReady = true
}

/* 集合访问器：col('orders') */
const col = (name) => db.collection(name)

/* ============================ 常量 ============================ */

const ADMIN_PASSWORD_KEY = 'adminPassword'
const BUSINESS_STATUS_KEY = 'businessStatus'
const DEFAULT_ADMIN_PASSWORD = 'orander2026'
const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

/* ============================ 工具 ============================ */

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(`orander-salt::${password}`).digest('hex')
}

const generateId = (prefix) => {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${random}`
}

const generateOrderNumber = () => {
  const ts = Date.now().toString().slice(-8)
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `OR-${ts}${rand}`
}

const parsePagination = (event = {}) => {
  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(event.pageSize) || PAGE_SIZE_DEFAULT))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

const ok = (data) => ({ ok: true, data })
const fail = (message) => ({ ok: false, data: null, message })
const log = (action, message) => {
  console.log(`[orander:${action}] ${message}`)
}

const nowIso = () => new Date().toISOString()

const openIdOf = () => {
  const wxContext = cloud.getWXContext()
  return wxContext.OPENID || ''
}

/* Haversine 距离（km） */
const distanceKm = (lng1, lat1, lng2, lat2) => {
  const rad = Math.PI / 180
  const dLng = (lng2 - lng1) * rad
  const dLat = (lat2 - lat1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

/* 原子自增计数器（排队号 / 单号等）：不存在则初始化 */
const nextCounter = async (key) => {
  const counters = col('counters')
  const existing = await counters.where({ key }).limit(1).get()
  if (existing.data.length === 0) {
    await counters.add({ data: { key, value: 0, createdAt: nowIso() } })
  }
  const updated = await counters.where({ key }).update({ data: { value: _.inc(1) } })
  if (updated.stats && updated.stats.updated === 0) {
    /* 并发初始化冲突兜底：重试一次 */
    await counters.where({ key }).update({ data: { value: _.inc(1) } })
  }
  const result = await counters.where({ key }).limit(1).get()
  return result.data[0].value
}

/* 管理员密码配置（兼容旧逻辑：首次自动播种默认密码哈希） */
const ensureAdminConfig = async () => {
  const config = col('config')
  const existing = await config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  if (existing.data.length === 0) {
    await config.add({
      data: {
        key: ADMIN_PASSWORD_KEY,
        value: hashPassword(DEFAULT_ADMIN_PASSWORD),
        updatedAt: nowIso(),
      },
    })
  }
  const result = await config.where({ key: ADMIN_PASSWORD_KEY }).limit(1).get()
  return result.data[0].value
}

/* 审计日志（管理端写操作） */
const writeAudit = async (action, detail = {}) => {
  try {
    await col('audit_logs').add({
      data: {
        id: generateId('audit'),
        action,
        detail,
        at: nowIso(),
      },
    })
  } catch (error) {
    log('audit', `write failed: ${error.message}`)
  }
}

module.exports = {
  cloud,
  db,
  _,
  col,
  ensureCollections,
  COLLECTION_NAMES,
  ADMIN_PASSWORD_KEY,
  BUSINESS_STATUS_KEY,
  DEFAULT_ADMIN_PASSWORD,
  hashPassword,
  generateId,
  generateOrderNumber,
  parsePagination,
  ok,
  fail,
  log,
  nowIso,
  openIdOf,
  distanceKm,
  nextCounter,
  ensureAdminConfig,
  writeAudit,
}
