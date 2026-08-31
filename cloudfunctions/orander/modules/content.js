/**
 * content 域：首页活动排期（5 模板）/ banner / 条款版本
 */
const { col, nowIso } = require('../lib/context')

const inWindow = (activity, at = new Date()) => {
  const start = activity.startAt ? new Date(activity.startAt) : null
  const end = activity.endAt ? new Date(activity.endAt) : null
  return (!start || start <= at) && (!end || end >= at)
}

module.exports = {
  async getHomeActivities() {
    const result = await col('activities').where({ status: 'ON' }).orderBy('order', 'asc').limit(20).get()
    const current = result.data.filter((activity) => inWindow(activity))
    return { activities: current }
  },

  async getActivity(event = {}) {
    const result = await col('activities').where({ id: event.activityId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('活动不存在')
    }
    return result.data[0]
  },

  async getBanners(event = {}) {
    const place = event.place || 'home'
    const result = await col('banners').where({ place, status: 'ON' }).orderBy('order', 'asc').limit(10).get()
    return { items: result.data }
  },

  /* 条款中心：列表 + 版本详情 */
  async getPolicies() {
    const result = await col('policies').orderBy('updatedAt', 'desc').limit(50).get()
    return { items: result.data }
  },

  async getPolicy(event = {}) {
    const result = await col('policies').where({ code: event.code }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('条款不存在')
    }
    return result.data[0]
  },

  /* ---- admin ---- */
  async saveBanner(event = {}) {
    const id = String(event.id || `bn-${Date.now()}`)
    const next = {
      id,
      place: String(event.place || 'home'),
      image: String(event.image || ''),
      link: String(event.link || ''),
      order: Number(event.order || 0),
      status: String(event.status || 'ON'),
      updatedAt: nowIso(),
    }
    const existing = await col('banners').where({ id }).limit(1).get()
    if (existing.data.length) {
      await col('banners').where({ id }).update({ data: next })
    } else {
      await col('banners').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  async deleteBanner(event = {}) {
    await col('banners').where({ id: String(event.id || '') }).remove()
    return { ok: true }
  },

  async saveActivity(event = {}) {
    const next = {
      id: (event.activity && event.activity.id) || `act-${Date.now()}`,
      ...(event.activity || {}),
      status: (event.activity && event.activity.status) || 'ON',
      updatedAt: nowIso(),
    }
    const existing = await col('activities').where({ id: next.id }).limit(1).get()
    if (existing.data.length) {
      await col('activities').where({ id: next.id }).update({ data: next })
    } else {
      await col('activities').add({ data: { ...next, createdAt: nowIso() } })
    }
    return next
  },

  async deleteActivity(event = {}) {
    await col('activities').where({ id: event.activityId }).remove()
    return { id: event.activityId }
  },

  async savePolicy(event = {}) {
    const next = {
      code: (event.policy && event.policy.code) || 'unknown',
      ...(event.policy || {}),
      updatedAt: nowIso(),
    }
    const existing = await col('policies').where({ code: next.code }).limit(1).get()
    if (existing.data.length) {
      await col('policies').where({ code: next.code }).update({ data: next })
    } else {
      await col('policies').add({ data: next })
    }
    return next
  },
}
