/**
 * cs 域：客服会话。默认 FAQ 关键词匹配；config 存 deepseekKey 时走 AI（默认关）。
 */
const { col, generateId, nowIso, openIdOf } = require('../lib/context')

const FAQ = [
  { keywords: ['会员', '等级', '成长'], answer: '消费 1 元得 1 成长值，满 100/300/600/1000 分别升至 V1-V4，等级越高福利越多。' },
  { keywords: ['退款', '退单'], answer: '已支付订单在「订单详情 → 申请退款」提交，主人确认后原路退回（模拟）。' },
  { keywords: ['券', '优惠', '折扣'], answer: '券在「我的 → 卡包」查看，下单结算时选择使用；兑换码在「兑换中心」输入。' },
  { keywords: ['排队', '取餐', '多久'], answer: '支付成功后获得排队号，可在订单详情实时查看制作进度。' },
  { keywords: ['发票'], answer: '订单完成后可在「我的 → 发票助手」按订单申请开票（模拟）。' },
]

const matchFaq = (question) => {
  const hit = FAQ.find((item) => item.keywords.some((keyword) => question.includes(keyword)))
  return hit ? hit.answer : '已收到你的消息，主人会尽快回复。也可拨打客服电话 400-000-0000（示例）。'
}

async function aiReply(question) {
  const configResult = await col('config').where({ key: 'deepseekApiKey' }).limit(1).get()
  if (configResult.data.length === 0 || !configResult.data[0].value) {
    return null
  }
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configResult.data[0].value}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v3',
        messages: [
          { role: 'system', content: '你是 Orander GO 茶饮店的客服，回答简洁友好，不超过 100 字。' },
          { role: 'user', content: question },
        ],
      }),
    })
    const payload = await response.json()
    return payload.choices && payload.choices[0] ? payload.choices[0].message.content : null
  } catch (error) {
    return null
  }
}

module.exports = {
  async createSession() {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const session = {
      id: generateId('cs'),
      openId,
      status: 'OPEN',
      messages: [],
      createdAt: nowIso(),
    }
    await col('cs_sessions').add({ data: session })
    return session
  },

  async listMySessions() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('cs_sessions').where({ openId }).orderBy('createdAt', 'desc').limit(20).get()
    return { items: result.data }
  },

  async getMessages(event = {}) {
    const openId = openIdOf()
    const result = await col('cs_sessions').where({ id: event.sessionId, openId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('会话不存在')
    }
    return { messages: result.data[0].messages || [] }
  },

  async sendMessage(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const result = await col('cs_sessions').where({ id: event.sessionId, openId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('会话不存在')
    }
    const session = result.data[0]

    const isImage = event.type === 'image' && !!event.imageFileId
    const userMessage = {
      role: 'user',
      content: isImage ? '[图片]' : String(event.content || '').slice(0, 500),
      at: nowIso(),
      ...(isImage ? { type: 'image', imageFileId: String(event.imageFileId).slice(0, 200) } : {}),
    }
    const botMessage = isImage
      ? { role: 'assistant', content: '图片已收到，人工客服会尽快查看，请补充文字描述问题～', at: nowIso() }
      : {
          role: 'assistant',
          content: await aiReply(userMessage.content).then((answer) => answer || matchFaq(userMessage.content)),
          at: nowIso(),
        }
    await col('cs_sessions').where({ id: session.id }).update({
      data: { messages: [...(session.messages || []), userMessage, botMessage] },
    })
    return { messages: [userMessage, botMessage] }
  },

  async closeSession(event = {}) {
    const openId = openIdOf()
    await col('cs_sessions').where({ id: event.sessionId, openId }).update({
      data: { status: 'CLOSED', closedAt: nowIso() },
    })
    return { id: event.sessionId, status: 'CLOSED' }
  },

  /* ---- admin ---- */
  async listSessions() {
    const result = await col('cs_sessions').orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },

  async takeoverSession(event = {}) {
    await col('cs_sessions').where({ id: event.sessionId }).update({
      data: { status: 'TAKEN', takenAt: nowIso() },
    })
    return { id: event.sessionId, status: 'TAKEN' }
  },

  async adminReply(event = {}) {
    const result = await col('cs_sessions').where({ id: event.sessionId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('会话不存在')
    }
    const session = result.data[0]
    const message = { role: 'staff', content: String(event.content || '').slice(0, 500), at: nowIso() }
    await col('cs_sessions').where({ id: session.id }).update({
      data: { messages: [...(session.messages || []), message] },
    })
    return message
  },
}
