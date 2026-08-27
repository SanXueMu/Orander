/**
 * groupmeal 域：团餐档期 / 时段余量 / 预定
 */
const { col, generateId, nowIso, openIdOf, _ } = require('../lib/context')

const SLOT_TIMES = ['11:00-12:00', '12:00-13:00', '17:00-18:00', '18:00-19:00']

/* 按需生成某日档期（每时段容量 2 桌） */
async function ensureSlots(date) {
  const existing = await col('gm_slots').where({ date }).limit(20).get()
  if (existing.data.length > 0) {
    return existing.data
  }
  const docs = SLOT_TIMES.map((time) => ({
    id: generateId('slot'),
    date,
    time,
    capacity: 2,
    reserved: 0,
    status: 'OPEN',
  }))
  await Promise.all(docs.map((doc) => col('gm_slots').add({ data: doc })))
  return docs
}

module.exports = {
  async getSlots(event = {}) {
    const date = event.date || new Date().toISOString().slice(0, 10)
    const slots = await ensureSlots(date)
    return {
      date,
      slots: slots.map((slot) => ({
        ...slot,
        remaining: Math.max(0, Number(slot.capacity || 0) - Number(slot.reserved || 0)),
      })),
    }
  },

  async reserveSlot(event = {}) {
    const openId = openIdOf()
    if (!openId) {
      throw new Error('请先登录')
    }
    const result = await col('gm_slots').where({ id: event.slotId }).limit(1).get()
    if (result.data.length === 0) {
      throw new Error('档期不存在')
    }
    const slot = result.data[0]
    if (Number(slot.reserved || 0) >= Number(slot.capacity || 0)) {
      throw new Error('该时段已满')
    }
    await col('gm_slots').where({ id: slot.id }).update({ data: { reserved: _.inc(1) } })
    const reservation = {
      id: generateId('gmr'),
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      openId,
      name: event.name || '',
      phone: event.phone || '',
      partySize: Number(event.partySize || 2),
      note: event.note || '',
      status: 'BOOKED',
      createdAt: nowIso(),
    }
    await col('gm_reservations').add({ data: reservation })
    return reservation
  },

  async myReservations() {
    const openId = openIdOf()
    if (!openId) {
      return { items: [] }
    }
    const result = await col('gm_reservations').where({ openId }).orderBy('createdAt', 'desc').limit(50).get()
    return { items: result.data }
  },

  /* ---- admin ---- */
  async setSlotCapacity(event = {}) {
    await col('gm_slots').where({ id: event.slotId }).update({
      data: { capacity: Number(event.capacity || 0) },
    })
    return { id: event.slotId }
  },

  async listReservations(event = {}) {
    const query = event.date ? { date: event.date } : {}
    const result = await col('gm_reservations').where(query).orderBy('createdAt', 'desc').limit(100).get()
    return { items: result.data }
  },
}
