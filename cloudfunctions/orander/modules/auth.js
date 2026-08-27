/**
 * auth 域：微信 OPENID 免密登录 + 管理员密码 + 协议签署
 */
const {
  col, hashPassword, ensureAdminConfig, generateId, nowIso, openIdOf,
} = require('../lib/context')

const AGREEMENT_VERSION = 'v3.324.0'

module.exports = {
  /* 微信登录：openid 建档/查找会员（替代旧 syncVisitor，保留旧名兼容） */
  async login(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('无法获取用户身份')
    }

    const memberId = `member-${openId}`
    const current = await col('members').where({ id: memberId }).limit(1).get()
    const nextMember = {
      id: memberId,
      openId,
      nickname: event.nickname || '访客',
      avatarUrl: event.avatarUrl || '',
      relation: '访客',
      customRelation: '',
      themeId: 'amber',
      fontId: 'modern',
      growthValue: current.data.length ? Number(current.data[0].growthValue || 0) : 0,
      level: current.data.length ? current.data[0].level || 'V0' : 'V0',
      agreedVersion: event.agreementSigned ? AGREEMENT_VERSION : current.data.length ? current.data[0].agreedVersion || '' : '',
      joinedAt: current.data.length ? current.data[0].joinedAt : nowIso(),
      updatedAt: nowIso(),
    }

    if (current.data.length) {
      await col('members').where({ id: memberId }).update({ data: nextMember })
    } else {
      await col('members').add({ data: nextMember })
    }
    return nextMember
  },

  async signAgreement(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('无法获取用户身份')
    }
    await col('members').where({ id: `member-${openId}` }).update({
      data: { agreedVersion: AGREEMENT_VERSION, agreedAt: nowIso() },
    })
    return { version: AGREEMENT_VERSION }
  },

  /* ---- 管理员（沿用旧机制） ---- */
  async verifyAdmin(event = {}) {
    const storedHash = await ensureAdminConfig()
    if (hashPassword(event.password || '') !== storedHash) {
      throw new Error('密码错误')
    }
    return { adminToken: storedHash }
  },

  async changeAdminPassword(event = {}) {
    const storedHash = await ensureAdminConfig()
    if ((event.adminToken || '') !== storedHash) {
      throw new Error('未授权')
    }
    if (!(event.newPassword || '').trim()) {
      throw new Error('密码不能为空')
    }
    const newHash = hashPassword(event.newPassword)
    await col('config').where({ key: 'adminPassword' }).update({
      data: { value: newHash, updatedAt: nowIso() },
    })
    return { adminToken: newHash }
  },
}
