/**
 * promotion 域：券模板/领券/券实例 / 兑换码 / 金喜卡(付费卡) / 周期福利 / 积分 / 钱包
 */
const { col, generateId, nowIso, openIdOf, _ } = require('../lib/context')
const notify = require('./notify')

const COUPON_STATUS = { USABLE: '可使用', USED: '已使用', EXPIRED: '已过期' }

const couponExpired = (coupon) => {
  const days = Number(coupon.validDays || 30)
  const expires = new Date(new Date(coupon.issuedAt).getTime() + days * 86400000)
  return expires < new Date()
}

const mapInstance = (doc = {}) => {
  let status = doc.status || 'USABLE'
  if (status === 'USABLE' && couponExpired(doc)) {
    status = 'EXPIRED'
  }
  return {
    id: doc.id,
    templateId: doc.templateId,
    name: doc.name || '',
    type: doc.type || 'AMOUNT',
    value: Number(doc.value || 0),
    threshold: Number(doc.threshold || 0),
    validDays: Number(doc.validDays || 30),
    issuedAt: doc.issuedAt,
    status,
    statusText: COUPON_STATUS[status] || status,
    usedOrderId: doc.usedOrderId || '',
  }
}

/* 计算最优券（下单时前端传 candidateId，服务端校验并抵扣） */
async function applyCoupon(orderId, openId, couponInstanceId, orderAmount) {
  if (!couponInstanceId) {
    return { discount: 0, couponInstanceId: '' }
  }
  const result = await col('coupon_instances').where({ id: couponInstanceId, openId }).limit(1).get()
  if (result.data.length === 0) {
    throw new Error('券不存在')
  }
  const coupon = mapInstance(result.data[0])
  if (coupon.status !== 'USABLE') {
    throw new Error('券不可用')
  }
  if (orderAmount < coupon.threshold) {
    throw new Error(`未满 ${coupon.threshold} 元，券不可用`)
  }
  const discount = Math.min(coupon.value, orderAmount)
  await col('coupon_instances').where({ id: couponInstanceId }).update({
    data: { status: 'USED', usedOrderId: orderId, usedAt: nowIso() },
  })
  return { discount: Number(discount.toFixed(2)), couponInstanceId }
}

/* 发券（模板 → 实例） */
async function issueCoupon(openId, template, extra = {}) {
  const doc = {
    id: generateId('ci'),
    openId,
    templateId: template.id,
    name: template.name,
    type: template.type || 'AMOUNT',
    value: Number(template.value || 0),
    threshold: Number(template.threshold || 0),
    validDays: Number(template.validDays || 30),
    status: 'USABLE',
    issuedAt: nowIso(),
    source: extra.source || 'activity',
  }
  await col('coupon_instances').add({ data: doc })
  await notify.push('coupon', '收到新券', `${template.name} 已放入卡包`, { toOpenId: openId })
  return mapInstance(doc)
}

module.exports = {
  COUPON_STATUS,
  mapInstance,
  issueCoupon,
  applyCoupon,

  async listAssets() {
    const openId = openIdOf()
    if (!openId) {
      return { coupons: [], cards: [], wallet: 0, points: 0, unread: 0 }
    }
    const [couponResult, cardResult, walletResult, pointsResult] = await Promise.all([
      col('coupon_instances').where({ openId }).orderBy('issuedAt', 'desc').limit(100).get(),
      col('paid_cards').where({ openId }).limit(20).get(),
      col('wallets').where({ openId }).limit(1).get(),
      col('points_flows').where({ openId, type: 'points' }).limit(200).get(),
    ])
    const points = pointsResult.data.reduce((sum, flow) => sum + Number(flow.delta || 0), 0)
    return {
      coupons: couponResult.data.map(mapInstance),
      cards: cardResult.data,
      wallet: walletResult.data.length ? Number(walletResult.data[0].balance || 0) : 0,
      points,
    }
  },

  async listCouponTemplates() {
    const result = await col('coupons').where({ status: 'ACTIVE' }).limit(50).get()
    return { items: result.data }
  },

  async receiveCoupon(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const result = await col('coupons').where({ id: event.templateId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('券模板不存在')
    }
    const template = result.data[0]
    if (Number(template.total || 0) > 0 && Number(template.issued || 0) >= Number(template.total)) {
      throw new Error('该券已领完')
    }
    const existing = await col('coupon_instances').where({ openId, templateId: template.id }).count()
    if (existing.total >= Number(template.limitPerUser || 1)) {
      throw new Error('已达领取上限')
    }
    const coupon = await issueCoupon(openId, template, { source: 'self' })
    await col('coupons').where({ id: template.id }).update({ data: { issued: _.inc(1) } })
    return coupon
  },

  /* 兑换码：CODE-{6位}，批次发放 */
  async redeemCode(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const code = String(event.code || '').trim().toUpperCase()
    const result = await col('codes').where({ code }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('兑换码无效')
    }
    const doc = result.data[0]
    if (doc.status === 'REDEEMED') {
      throw new Error('兑换码已被使用')
    }
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      throw new Error('兑换码已过期')
    }

    if (doc.rewardType === 'POINTS') {
      await col('points_flows').add({
        data: { id: generateId('pf'), openId, type: 'points', delta: Number(doc.rewardValue || 0), reason: '兑换码', at: nowIso() },
      })
    } else if (doc.rewardType === 'COUPON') {
      const tplResult = await col('coupons').where({ id: doc.rewardValue }).limit(1).get()
      if (tplResult.data.length) {
        await issueCoupon(openId, tplResult.data[0], { source: 'code' })
      }
    } else if (doc.rewardType === 'WALLET') {
      await this.addWallet(openId, Number(doc.rewardValue || 0), '兑换码充值')
    }

    await col('codes').where({ code }).update({
      data: { status: 'REDEEMED', redeemedBy: openId, redeemedAt: nowIso() },
    })
    return { rewardType: doc.rewardType, rewardValue: doc.rewardValue }
  },

  /* 金喜卡（付费卡）：卡号+激活码 */
  async redeemCard(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const result = await col('paid_cards').where({ cardNo: event.cardNo }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('卡号无效')
    }
    const card = result.data[0]
    if (card.status !== 'INACTIVE') {
      throw new Error('该卡已被激活')
    }
    if (card.activeCode !== String(event.activeCode || '').trim()) {
      throw new Error('激活码错误')
    }
    await col('paid_cards').where({ cardNo: card.cardNo }).update({
      data: { status: 'ACTIVE', openId, activatedAt: nowIso() },
    })
    await notify.push('card', '金喜卡已激活', `${card.name} 生效，下单自动享 ${card.discountText || '8.8 折'}`, { toOpenId: openId })
    return { cardNo: card.cardNo, name: card.name }
  },

  /* ---- 福利管理（R8：手绘横幅/手写标题配图） ---- */
  async listAllBenefits() {
    const result = await col('benefits').limit(50).get()
    return { items: result.data }
  },

  async saveBenefit(event = {}) {
    const code = String(event.code || '')
    if (!code) throw new Error('缺少福利 code')
    const next = {
      code,
      title: String(event.title || ''),
      subtitle: String(event.subtitle || ''),
      description: String(event.description || ''),
      image: String(event.image || ''),
      heroTitle: String(event.heroTitle || ''),
      status: String(event.status || 'ACTIVE'),
      updatedAt: nowIso(),
    }
    const existing = await col('benefits').where({ code }).limit(1).get()
    if (existing.data.length) {
      await col('benefits').where({ code }).update({ data: next })
    } else {
      await col('benefits').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  /* 周期福利：benefits 集合存规则（code: MONDAY_FREE_FEE / NEWBIE_20 / STUDENT_CARD / GOLD_CARD） */
  async listBenefits() {
    const openId = openIdOf()
    const result = await col('benefits').where({ status: 'ACTIVE' }).limit(50).get()
    if (!openId) {
      return { items: result.data, claimed: [] }
    }
    const grantResult = await col('benefit_grants').where({ openId }).limit(100).get()
    return {
      items: result.data,
      claimed: grantResult.data.map((doc) => ({ code: doc.code, at: doc.at })),
    }
  },

  async claimBenefit(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const result = await col('benefits').where({ code: event.code }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('福利不存在')
    }
    const benefit = result.data[0]
    const existing = await col('benefit_grants').where({ openId, code: benefit.code }).count()
    if (existing.total > 0) {
      throw new Error('已领取过该福利')
    }

    if (benefit.couponTemplateId) {
      const tplResult = await col('coupons').where({ id: benefit.couponTemplateId }).limit(1).get()
      if (tplResult.data.length) {
        await issueCoupon(openId, tplResult.data[0], { source: `benefit:${benefit.code}` })
      }
    }
    await col('benefit_grants').add({
      data: { id: generateId('bg'), openId, code: benefit.code, at: nowIso() },
    })
    return { code: benefit.code, ok: true }
  },

  async listPointsFlow() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('points_flows').where({ openId, type: 'points' }).orderBy('at', 'desc').limit(100).get()
    return { items: result.data }
  },

  async addWallet(openId, delta, reason) {
    const existing = await col('wallets').where({ openId }).limit(1).get()
    if (existing.data.length === 0) {
      await col('wallets').add({ data: { openId, balance: Number(delta), updatedAt: nowIso() } })
      return Number(delta)
    }
    const balance = Number(existing.data[0].balance || 0) + Number(delta)
    await col('wallets').where({ openId }).update({ data: { balance, updatedAt: nowIso() } })
    return balance
  },

  /* ---- admin ---- */
  async createCouponTemplate(event = {}) {
    const template = {
      id: generateId('tpl'),
      name: event.name || '未命名券',
      type: event.type || 'AMOUNT',
      value: Number(event.value || 0),
      threshold: Number(event.threshold || 0),
      validDays: Number(event.validDays || 30),
      total: Number(event.total || 0),
      issued: 0,
      limitPerUser: Number(event.limitPerUser || 1),
      image: String(event.image || ''),
      status: 'ACTIVE',
      createdAt: nowIso(),
    }
    await col('coupons').add({ data: template })
    return template
  },

  async createCodeBatch(event = {}) {
    const count = Math.min(500, Math.max(1, Number(event.count || 10)))
    const batchId = generateId('batch')
    const docs = []
    for (let index = 0; index < count; index += 1) {
      const code = `CODE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      docs.push({
        code,
        batchId,
        rewardType: event.rewardType || 'POINTS',
        rewardValue: event.rewardValue || 100,
        status: 'UNUSED',
        expiresAt: event.expiresAt || '',
        createdAt: nowIso(),
      })
    }
    await Promise.all(docs.map((doc) => col('codes').add({ data: doc })))
    return { batchId, count, codes: docs.map((doc) => doc.code) }
  },

  async grantCoupon(event = {}) {
    const tplResult = await col('coupons').where({ id: event.templateId }).limit(1).get()
    if (tplResult.data.length === 0) {
      throw new Error('券模板不存在')
    }
    const targets = event.openIds || []
    const issued = []
    for (const openId of targets) {
      issued.push(await issueCoupon(openId, tplResult.data[0], { source: 'admin' }))
    }
    return { issued: issued.length }
  },
}
