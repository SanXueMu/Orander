/**
 * notify 域：站内信（铃铛）。订阅消息受个人主体类目限制，仅占位。
 */
const { col, generateId, nowIso, openIdOf } = require('../lib/context')

/* 其他模块内部调用：给某 openid 推一条站内信 */
async function push(type, title, content, extra = {}) {
  const openId = extra.toOpenId || openIdOf()
  if (!openId) {
    return null
  }
  const doc = {
    id: generateId('ntf'),
    openId,
    type,
    title,
    content,
    read: false,
    at: nowIso(),
  }
  await col('notifications').add({ data: doc })
  return doc
}

module.exports = {
  push,

  async listNotifications(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      return { items: [], unread: 0 }
    }
    const result = await col('notifications').where({ openId }).orderBy('at', 'desc').limit(50).get()
    return {
      items: result.data,
      unread: result.data.filter((doc) => !doc.read).length,
    }
  },

  async markRead(event = {}) {
    const openId = openIdOf()
    await col('notifications').where({ id: event.notificationId, openId }).update({
      data: { read: true },
    })
    return { id: event.notificationId }
  },

  async markAllRead() {
    const openId = openIdOf()
    await col('notifications').where({ openId, read: false }).update({
      data: { read: true },
    })
    return { ok: true }
  },
}
