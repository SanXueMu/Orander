/**
 * Orander 云函数 · 喜茶GO 复刻 R1 架构
 * 瘦入口：action 路由 → modules/ 分域分发 + 管理员鉴权 + 审计日志 + 播种
 */
const {
  ensureCollections, ensureAdminConfig, writeAudit, ok, fail, log,
} = require('./lib/context')
const { runSeed } = require('./seed')

const auth = require('./modules/auth')
const member = require('./modules/member')
const product = require('./modules/product')
const store = require('./modules/store')
const trade = require('./modules/trade')
const payment = require('./modules/payment')
const promotion = require('./modules/promotion')
const mall = require('./modules/mall')
const review = require('./modules/review')
const cs = require('./modules/cs')
const invoice = require('./modules/invoice')
const content = require('./modules/content')
const notify = require('./modules/notify')
const groupmeal = require('./modules/groupmeal')
const report = require('./modules/report')

/* ============================
 * Action 注册表（模块直出 + 旧名兼容别名）
 * ============================ */
const actions = {
  /* auth */
  login: auth.login,
  signAgreement: auth.signAgreement,
  verifyAdmin: auth.verifyAdmin,
  changeAdminPassword: auth.changeAdminPassword,
  syncVisitor: auth.login, // 旧名兼容

  /* member */
  getMemberProfile: member.getMemberProfile,
  getLevelCards: member.getLevelCards,
  listMembers: member.listMembers, // 旧名兼容
  deleteMember: member.deleteMember, // 旧名兼容

  /* product */
  getProductCatalog: product.getProductCatalog,
  searchProducts: product.searchProducts,
  saveSpu: product.saveSpu,
  deleteSpu: product.deleteSpu,
  saveCategory: product.saveCategory,
  bootstrap: product.bootstrap, // 旧名兼容
  listDishes: product.listDishes, // 旧名兼容
  saveDish: product.saveDish, // 旧名兼容
  deleteDish: product.deleteDish, // 旧名兼容

  /* store */
  getStores: store.getStores,
  getStore: store.getStore,
  getStoreMenu: store.getStoreMenu,
  setStoreSpuOverride: store.setStoreSpuOverride,
  saveStore: store.saveStore,
  getBusinessStatus: store.getBusinessStatus, // 旧名兼容
  setBusinessStatus: store.setBusinessStatus, // 旧名兼容

  /* trade */
  previewOrder: trade.previewOrder,
  createOrderV2: trade.createOrderV2,
  payOrder: trade.payOrder,
  cancelOrder: trade.cancelOrder,
  refundApply: trade.refundApply,
  startPreparing: trade.startPreparing,
  completeOrder: trade.completeOrder,
  getMyOrders: trade.getMyOrders,
  getOrderDetail: trade.getOrderDetail,
  getQueue: trade.getQueue,
  createOrder: trade.createOrder, // 旧名兼容
  listMemberOrders: trade.listMemberOrders, // 旧名兼容
  listAllOrders: trade.listAllOrders, // 旧名兼容
  updateOrderStatus: trade.updateOrderStatus, // 旧名兼容

  /* payment */
  listPayments: payment.listPayments,
  listRefunds: payment.listRefunds,
  reviewRefund: payment.reviewRefund,

  /* promotion */
  listAssets: promotion.listAssets,
  listAllBenefits: promotion.listAllBenefits,
  saveBenefit: promotion.saveBenefit,
  listCouponTemplates: promotion.listCouponTemplates,
  receiveCoupon: promotion.receiveCoupon,
  listMyCoupons: promotion.listAssets,
  redeemCode: promotion.redeemCode,
  redeemCard: promotion.redeemCard,
  listBenefits: promotion.listBenefits,
  claimBenefit: promotion.claimBenefit,
  listPointsFlow: promotion.listPointsFlow,
  createCouponTemplate: promotion.createCouponTemplate,
  createCodeBatch: promotion.createCodeBatch,
  grantCoupon: promotion.grantCoupon,

  /* mall */
  getMallFloors: mall.getMallFloors,
  getMallProducts: mall.getMallProducts,
  getMallProduct: mall.getMallProduct,
  saveMallProduct: mall.saveMallProduct,
  setMallStock: mall.setMallStock,

  /* review */
  submitReview: review.submitReview,
  listMyReviews: review.listMyReviews,
  listReviews: review.listReviews,
  moderateReview: review.moderateReview,
  replyReview: review.replyReview,

  /* cs */
  createSession: cs.createSession,
  listMySessions: cs.listMySessions,
  getMessages: cs.getMessages,
  sendMessage: cs.sendMessage,
  closeSession: cs.closeSession,
  listSessions: cs.listSessions,
  takeoverSession: cs.takeoverSession,
  adminReply: cs.adminReply,

  /* invoice */
  listInvoicableOrders: invoice.listInvoicableOrders,
  applyInvoice: invoice.applyInvoice,
  listTitles: invoice.listTitles,
  saveTitle: invoice.saveTitle,
  deleteTitle: invoice.deleteTitle,
  listInvoiceRecords: invoice.listInvoiceRecords,
  listApplies: invoice.listApplies,
  issueInvoice: invoice.issueInvoice,

  /* content */
  getHomeActivities: content.getHomeActivities,
  getActivity: content.getActivity,
  getBanners: content.getBanners,
  saveBanner: content.saveBanner,
  deleteBanner: content.deleteBanner,
  getPolicies: content.getPolicies,
  getPolicy: content.getPolicy,
  saveActivity: content.saveActivity,
  deleteActivity: content.deleteActivity,
  savePolicy: content.savePolicy,

  /* notify */
  listNotifications: notify.listNotifications,
  markRead: notify.markRead,
  markAllRead: notify.markAllRead,

  /* groupmeal */
  getSlots: groupmeal.getSlots,
  reserveSlot: groupmeal.reserveSlot,
  myReservations: groupmeal.myReservations,
  setSlotCapacity: groupmeal.setSlotCapacity,
  listReservations: groupmeal.listReservations,

  /* report */
  getDashboard: report.getDashboard,
  getOrderStats: report.getOrderStats, // 旧名兼容
  listMembersWithStats: report.listMembersWithStats,
}

/* 需要管理员鉴权的 action */
const ADMIN_ONLY = new Set([
  'changeAdminPassword',
  'saveDish', 'deleteDish',
  'saveSpu', 'deleteSpu', 'saveCategory',
  'saveStore', 'setStoreSpuOverride',
  'deleteMember',
  'updateOrderStatus', 'startPreparing', 'completeOrder',
  'reviewRefund',
  'createCouponTemplate', 'createCodeBatch', 'grantCoupon',
  'saveMallProduct', 'setMallStock',
  'moderateReview', 'replyReview',
  'listSessions', 'takeoverSession', 'adminReply',
  'listApplies', 'issueInvoice',
  'saveActivity', 'deleteActivity', 'savePolicy',
  'saveBanner', 'deleteBanner', 'saveBenefit', 'listAllBenefits',
  'setSlotCapacity', 'listReservations',
  'setBusinessStatus',
  'getDashboard',
])

let seeded = false

exports.main = async (event = {}) => {
  const { action } = event
  const handler = actions[action]

  if (!handler) {
    return fail('unknown action')
  }

  try {
    await ensureCollections()
    if (!seeded) {
      await runSeed()
      seeded = true
    }
    if (ADMIN_ONLY.has(action)) {
      const expectedToken = await ensureAdminConfig()
      if ((event.adminToken || '') !== expectedToken) {
        log(action, 'unauthorized')
        return fail('未授权的管理操作')
      }
    }

    log(action, 'start')
    const result = await handler(event)
    log(action, 'done')

    if (ADMIN_ONLY.has(action) && action !== 'verifyAdmin') {
      await writeAudit(action, { order: 'ok' })
    }
    return ok(result)
  } catch (error) {
    log(action, `error: ${error.message}`)
    return fail(error.message || 'cloud error')
  }
}
