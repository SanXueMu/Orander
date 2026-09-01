/**
 * seed：新集合首次初始化时播种示例数据（已有数据则跳过）
 * 幂等：按集合逐个检查是否为空，只补空集合
 */
const { col, nowIso } = require('./lib/context')

const SPEC_CUP = {
  id: 'g-cup', name: '杯型', single: true,
  options: [
    { id: 'o-cup-m', name: '中杯', price: 0 },
    { id: 'o-cup-l', name: '大杯', price: 3 },
  ],
}
const SPEC_TEMP = {
  id: 'g-temp', name: '温度', single: true,
  options: [
    { id: 'o-temp-ice', name: '冰', price: 0 },
    { id: 'o-temp-less', name: '少冰', price: 0 },
    { id: 'o-temp-hot', name: '热', price: 0 },
  ],
}
const SPEC_SWEET = {
  id: 'g-sweet', name: '甜度', single: true,
  options: [
    { id: 'o-sw-standard', name: '标准糖', price: 0 },
    { id: 'o-sw-less', name: '少糖', price: 0 },
    { id: 'o-sw-none', name: '无糖', price: 0 },
  ],
}
const SPEC_ADD = {
  id: 'g-add', name: '加料', single: false,
  options: [
    { id: 'o-add-bobo', name: '黑糖波波', price: 3 },
    { id: 'o-add-cheese', name: '芝士奶盖', price: 5 },
    { id: 'o-add-coconut', name: '椰果', price: 2 },
  ],
}

const CATEGORIES = [
  { id: 'cat-new', name: '上新', order: 1 },
  { id: 'cat-signature', name: '招牌推荐', order: 2 },
  { id: 'cat-classic', name: '经典茶饮', order: 3 },
  { id: 'cat-snack', name: '灵感茶点', order: 4 },
]

const SPUS = [
  { id: 'spu-qilan', name: '奇兰苹果杏', categoryId: 'cat-new', basePrice: 25, description: '奇兰乌龙 × 苹果杏，果香明亮', tags: ['上新', '含茶'], soldCount: 328, specGroups: [SPEC_CUP, SPEC_TEMP, SPEC_SWEET] },
  { id: 'spu-grape', name: '多肉葡萄', categoryId: 'cat-signature', basePrice: 29, description: '手剥巨峰葡萄，满杯果肉', tags: ['招牌', '含茶'], soldCount: 1024, specGroups: [SPEC_CUP, SPEC_TEMP, SPEC_SWEET, SPEC_ADD] },
  { id: 'spu-yangzhi', name: '杨枝甘露', categoryId: 'cat-signature', basePrice: 26, description: '芒果西柚西米，经典港式', tags: ['招牌'], soldCount: 866, specGroups: [SPEC_CUP, SPEC_TEMP, SPEC_SWEET] },
  { id: 'spu-cheese-green', name: '芝士绿妍茶后', categoryId: 'cat-classic', basePrice: 19, description: '茉莉绿茶底 + 芝士奶盖', tags: ['含茶'], soldCount: 2048, specGroups: [SPEC_CUP, SPEC_TEMP, SPEC_SWEET, SPEC_ADD] },
  { id: 'spu-brown-sugar', name: '烤黑糖波波牛乳', categoryId: 'cat-classic', basePrice: 22, description: '黑糖挂壁，波波 Q 弹', tags: [], soldCount: 1536, specGroups: [SPEC_CUP, SPEC_TEMP] },
  { id: 'spu-light-milk', name: '轻乳茶', categoryId: 'cat-classic', basePrice: 18, description: '低糖轻负担，醇厚顺滑', tags: ['低糖'], soldCount: 612, specGroups: [SPEC_CUP, SPEC_TEMP, SPEC_SWEET] },
  { id: 'spu-cone', name: '纯绿茶脆筒', categoryId: 'cat-snack', basePrice: 12, description: '绿茶冰淇淋，现做脆筒', tags: ['茶点'], soldCount: 452, specGroups: [] },
  { id: 'spu-cookie', name: '芝士夹心饼干', categoryId: 'cat-snack', basePrice: 15, description: '咸芝士夹心，配茶一绝', tags: ['茶点'], soldCount: 298, specGroups: [] },
]

const STORES = [
  { id: 'store-home', name: 'Orander 旗舰店（到家）', address: '北京市朝阳区灵感街 88 号', lng: 116.481, lat: 39.99, businessHours: '10:00-22:00', supportPickup: true, supportDelivery: true, open: true },
  { id: 'store-lab', name: '灵感实验室店', address: '北京市海淀区茶香路 6 号', lng: 116.31, lat: 39.98, businessHours: '11:00-21:00', supportPickup: true, supportDelivery: false, open: true },
]

const ACTIVITIES = [
  { id: 'act-new-tea', template: 'NEW_PRODUCT', title: '奇兰苹果杏 · 新品首发', subtitle: '果香明亮，一杯入春', image: '', startAt: '', endAt: '', order: 1, status: 'ON' },
  { id: 'act-anniversary', template: 'ANNIVERSARY', title: '周年庆 · 第二杯半价', subtitle: '和朋友分享这一杯', image: '', startAt: '', endAt: '', order: 2, status: 'ON' },
  { id: 'act-invite', template: 'INVITE_MEMBER', title: '邀请好友，各得 20 元券', subtitle: '好茶要一起喝', image: '', startAt: '', endAt: '', order: 3, status: 'ON' },
]

const COUPON_TEMPLATES = [
  { id: 'tpl-25-4', name: '满 25 减 4 元券', type: 'AMOUNT', value: 4, threshold: 25, validDays: 30, total: 100, issued: 0, limitPerUser: 1, status: 'ACTIVE' },
  { id: 'tpl-35-6', name: '满 35 减 6 元券', type: 'AMOUNT', value: 6, threshold: 35, validDays: 30, total: 100, issued: 0, limitPerUser: 2, status: 'ACTIVE' },
  { id: 'tpl-free-fee', name: '免配送费券', type: 'FREE_FEE', value: 6, threshold: 0, validDays: 30, total: 200, issued: 0, limitPerUser: 3, status: 'ACTIVE' },
]

const BENEFITS = [
  { code: 'MONDAY_FREE_FEE', name: '周一免配送费', description: '每周一 V1 及以上会员下单免配送费', couponTemplateId: 'tpl-free-fee', status: 'ACTIVE' },
  { code: 'NEWBIE_20', name: '新人礼 · 满 20 减 5', description: '注册即领的首单福利', couponTemplateId: 'tpl-25-4', status: 'ACTIVE' },
  { code: 'GOLD_CARD', name: '金喜卡 8.8 折', description: '付费卡：开卡享 90 天金喜权益，全单 8.8 折', couponTemplateId: '', status: 'ACTIVE' },
  { code: 'WARM_TEA', name: '暖心为你', description: '每月可领指定热饮 8.8 折券，女生专享', couponTemplateId: '', status: 'ACTIVE' },
  { code: 'STUDENT_CARD', name: '学子卡', description: '学生认证免费开通，周末第二杯半价', couponTemplateId: '', status: 'ACTIVE' },
]

const PAID_CARDS = []

const MALL_PRODUCTS = [
  { id: 'mall-bottle-grape', name: '多肉葡萄瓶装 300ml×6', floor: 'bottle', floorName: '喜茶瓶装', price: 69, originalPrice: 89, stock: 50, soldCount: 120, floorOrder: 2, status: 'ON' },
  { id: 'mall-bottle-green', name: '绿妍茶底瓶装 300ml×6', floor: 'bottle', floorName: '喜茶瓶装', price: 59, originalPrice: 75, stock: 40, soldCount: 88, floorOrder: 2, status: 'ON' },
  { id: 'mall-gift-tea', name: '灵感茶礼盒 · 春茶季', floor: 'gift', floorName: '茶礼盒', price: 168, originalPrice: 198, stock: 20, soldCount: 45, floorOrder: 3, status: 'ON' },
  { id: 'mall-gift-pair', name: '茶点伴手礼双拼', floor: 'gift', floorName: '茶礼盒', price: 98, originalPrice: 118, stock: 30, soldCount: 32, floorOrder: 3, status: 'ON' },
  { id: 'mall-goods-tote', name: '灵感帆布袋', floor: 'goods', floorName: '灵感周边', price: 49, originalPrice: 0, stock: 100, soldCount: 210, floorOrder: 4, status: 'ON' },
  { id: 'mall-goods-mug', name: '茶杯马克杯', floor: 'goods', floorName: '灵感周边', price: 79, originalPrice: 99, stock: 60, soldCount: 156, floorOrder: 4, status: 'ON' },
  { id: 'mall-new-set', name: '新品首发套装（2 杯装券×2）', floor: 'new', floorName: '灵感上新', price: 45, originalPrice: 56, stock: 80, soldCount: 66, floorOrder: 1, status: 'ON' },
]

const POLICIES = [
  { code: 'user-agreement', title: 'Orander GO 用户服务协议', version: 'v3.324.0', body: '本协议是你与 Orander GO 之间关于使用本小程序服务所订立的契约……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
  { code: 'privacy', title: '隐私政策', version: 'v3.324.0', body: '我们收集的信息类型、用途及保护措施……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
  { code: 'member-rules', title: '会员规则', version: 'v2.1.0', body: '成长值获取、等级权益、有效期说明……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
  { code: 'point-rules', title: '积分规则', version: 'v1.8.0', body: '积分获取与消耗、过期清零规则……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
  { code: 'refund-policy', title: '退换货与退款政策', version: 'v1.5.0', body: '退款申请条件、处理时效、原路退回说明……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
  { code: 'invoice-policy', title: '发票开具规则', version: 'v1.3.0', body: '可开票业务线、抬头管理、开具时效……（示例正文）', updatedAt: '2026-08-27T00:00:00.000Z' },
]

const isEmpty = async (name) => {
  const result = await col(name).limit(1).get()
  return result.data.length === 0
}

const seedIfEmpty = async (name, docs) => {
  if (docs.length === 0 || !(await isEmpty(name))) {
    return false
  }
  await Promise.all(docs.map((doc) => col(name).add({ data: { ...doc, createdAt: doc.createdAt || nowIso() } })))
  return true
}

const BANNERS = [
  { id: 'bn-dish-1', place: 'dish', image: '', link: '', order: 1, status: 'ON', title: '轻乳茶上新' },
  { id: 'bn-dish-2', place: 'dish', image: '', link: '', order: 2, status: 'ON', title: '多肉杨梅回归' },
  { id: 'bn-mall-1', place: 'mall', image: '', link: '', order: 1, status: 'ON', title: '茶礼盒专区' },
]

const runSeed = async () => {
  await seedIfEmpty('banners', BANNERS)
  await seedIfEmpty('categories', CATEGORIES)
  await seedIfEmpty('spus', SPUS)
  await seedIfEmpty('stores', STORES)
  await seedIfEmpty('activities', ACTIVITIES)
  await seedIfEmpty('coupons', COUPON_TEMPLATES)
  await seedIfEmpty('benefits', BENEFITS)
  await seedIfEmpty('paid_cards', PAID_CARDS)
  await seedIfEmpty('mall_products', MALL_PRODUCTS)
  await seedIfEmpty('policies', POLICIES)
}

module.exports = { runSeed }
