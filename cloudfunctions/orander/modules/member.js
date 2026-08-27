/**
 * member 域：会员档案 / 成长值 / V0-V4 等级 / 花名册（旧 listMembers 兼容）
 */
const { col, generateId, nowIso, openIdOf } = require('../lib/context')

/* 等级阶梯（成长值门槛） */
const LEVELS = [
  { level: 'V0', name: '新客', threshold: 0, perk: '注册即享新人礼' },
  { level: 'V1', name: '茶友', threshold: 100, perk: '周一免配送费资格' },
  { level: 'V2', name: '茶咖', threshold: 300, perk: '会员日 88 折' },
  { level: 'V3', name: '茶痴', threshold: 600, perk: '新品优先试饮' },
  { level: 'V4', name: '灵感家', threshold: 1000, perk: '专属客服 + 生日礼' },
]

const levelOf = (growth) => {
  let matched = LEVELS[0]
  LEVELS.forEach((item) => {
    if (growth >= item.threshold) {
      matched = item
    }
  })
  return matched
}

const mapMember = (doc = {}) => ({
  id: doc.id,
  nickname: doc.nickname || '',
  avatarUrl: doc.avatarUrl || '',
  relation: doc.relation || '访客',
  customRelation: doc.customRelation || '',
  themeId: doc.themeId || 'amber',
  fontId: doc.fontId || 'modern',
  growthValue: Number(doc.growthValue || 0),
  level: doc.level || 'V0',
  joinedAt: doc.joinedAt || nowIso(),
})

/* 当前登录会员完整档案（含等级解析 + 下一级差值） */
async function getMemberProfile() {
  const openId = openIdOf()
  if (!openId) {
    throw new Error('未登录')
  }
  const result = await col('members').where({ id: `member-${openId}` }).limit(1).get()
  if (result.data.length === 0) {
    throw new Error('会员不存在')
  }
  const raw = result.data[0]
  const growth = Number(raw.growthValue || 0)
  const current = levelOf(growth)
  const nextLevel = LEVELS.find((item) => item.threshold > growth) || null
  return {
    ...mapMember(raw),
    levelName: current.name,
    levelPerk: current.perk,
    nextLevel: nextLevel ? nextLevel.level : null,
    nextGap: nextLevel ? nextLevel.threshold - growth : 0,
    levels: LEVELS,
  }
}

/* 订单完成时加成长值（trade 域内部调用） */
async function addGrowth(openId, delta, reason) {
  const memberId = `member-${openId}`
  const result = await col('members').where({ id: memberId }).limit(1).get()
  if (result.data.length === 0) {
    return null
  }
  const growth = Number(result.data[0].growthValue || 0) + delta
  await col('members').where({ id: memberId }).update({
    data: { growthValue: growth, level: levelOf(growth).level, updatedAt: nowIso() },
  })
  await col('points_flows').add({
    data: { id: generateId('growth'), memberId, type: 'growth', delta, reason, at: nowIso() },
  })
  return growth
}

module.exports = {
  LEVELS,
  levelOf,
  mapMember,
  getMemberProfile,
  addGrowth,

  async getLevelCards() {
    return LEVELS
  },

  /* ---- 旧 action 兼容 ---- */
  async listMembers() {
    const [memberResult, orderResult] = await Promise.all([
      col('members').limit(100).get(),
      col('orders').limit(200).get(),
    ])
    const orders = orderResult.data
    return memberResult.data.map(mapMember)
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .map((member) => {
        const related = orders.filter((order) => order.memberId === member.id)
        return {
          ...member,
          ordersCount: related.length,
          lastOrderAt: related.length ? related.map((o) => o.createdAt).sort().pop() : member.joinedAt,
        }
      })
  },

  async deleteMember(event = {}) {
    await Promise.all([
      col('members').where({ id: event.memberId }).remove(),
      col('orders').where({ memberId: event.memberId }).remove(),
    ])
    return { id: event.memberId }
  },
}
