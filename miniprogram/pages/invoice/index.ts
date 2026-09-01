import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember, getSession } from '../../utils/orander'
import {
  invApplyCloud, invDeleteTitleCloud, invListOrdersCloud,
  invListRecordsCloud, invListTitlesCloud, invSaveTitleCloud,
  type TitleRecord,
} from '../../utils/cloud'

type View = 'home' | 'orders' | 'record' | 'help' | 'titles' | 'titleForm'

interface OrderRow {
  id: string
  orderNumber: string
  biz: string
  amount: number
  createdAt?: string
  picked?: boolean
}

interface HomeRow {
  key: string
  name: string
  sub: string
}

const BIZ_ROWS: HomeRow[] = [
  { key: 'TEA', name: '门店订单开票', sub: '仅支持 Orander GO 订单自助开票' },
  { key: 'MALL', name: '百货订单开票', sub: '' },
  { key: 'PAID_CARD', name: '喜卡购买开票', sub: '' },
  { key: 'MEMBER', name: '星球会员购买开票', sub: '' },
  { key: 'WALLET', name: '喜钱袋充值开票', sub: '' },
  { key: 'GOLD_CARD', name: '金领卡购买开票', sub: '' },
  { key: 'GOLDEN', name: '金喜卡购买开票', sub: '' },
]

const HOME_ROWS: HomeRow[] = [
  ...BIZ_ROWS,
  { key: 'RECORD', name: '开票记录', sub: '' },
  { key: 'HELP', name: '开票帮助', sub: '' },
  { key: 'TITLES', name: '常用抬头', sub: '' },
]

const VIEW_TITLE: Record<string, string> = {
  orders: '订单列表',
  record: '开票记录',
  help: '开票帮助',
  titles: '常用抬头',
  titleForm: '抬头信息',
}

const STATUS_TEXT: Record<string, string> = { PENDING: '待开具', ISSUED: '已开具' }

const HELP_SECTIONS = [
  { t: '一、发票申请渠道', c: '可在「发票助手」中对已完成的门店订单、百货订单等自助申请电子发票；充值与购卡业务按实际支付金额开具。' },
  { t: '二、发票信息填写规范', c: '抬头名称需与税号一致（企业抬头）；个人抬头无需税号。开户银行与账号为选填，填写后将在票面展示。' },
  { t: '三、开票后变动处理', c: '电子发票开具后不支持换开。如票面信息有误，请在开具前核对抬头；误开请联系客服作废后重新申请。' },
  { t: '四、退款订单发票处理', c: '已开具发票的订单发生退款时，将同步冲红原发票；申请中的发票随退款自动撤销。' },
  { t: '五、合规提示及电票说明', c: '本小程序开具的均为电子普通发票，与纸质发票具有同等法律效力，可在开票记录中重复查看下载。' },
]

const emptyForm = () => ({
  id: '',
  titleType: 'PERSONAL' as 'COMPANY' | 'PERSONAL',
  name: '',
  taxNo: '',
  address: '',
  phone: '',
  bank: '',
  bankAccount: '',
  isDefault: false,
})

Page({
  behaviors: [pageLookBehavior],

  data: {
    view: 'home' as View,
    viewTitle: '',
    homeRows: HOME_ROWS,
    helpSections: HELP_SECTIONS,
    navColor: '',
    navBackground: '',
    /* orders 视图 */
    bizKey: 'TEA',
    bizName: '门店订单开票',
    orders: [] as OrderRow[],
    allPicked: false,
    pickedCount: 0,
    pickedAmount: '0.00',
    submitting: false,
    loadingOrders: true,
    scanOpen: false,
    /* 抬头选择抽屉 */
    titleSheet: false,
    titles: [] as TitleRecord[],
    activeTitleId: '',
    /* 记录 */
    records: [] as Array<{ id: string; amount: number; statusText: string; orderNumbers: string[]; date: string; invoiceNo?: string }>,
    /* 抬头表单 */
    form: emptyForm(),
  },

  onLoad(query: Record<string, string | undefined>) {
    if (query.orderId) {
      this.setData({ view: 'orders', viewTitle: VIEW_TITLE.orders, bizKey: 'TEA', bizName: '门店订单开票' })
      this._prefillOrderId = query.orderId
    }
  },

  _prefillOrderId: '',

  onShow() {
    applyPageLook(this, getCurrentMember())
    if (!getSession()) {
      wx.navigateTo({ url: '/pages/profile-edit/index' })
      return
    }
    void this.refresh()
  },

  noop() {
    /* 阻止遮罩点击穿透 */
  },

  backHome() {
    if (this.data.view === 'titleForm') {
      this.setData({ view: 'titles', viewTitle: VIEW_TITLE.titles })
    } else {
      this.setData({ view: 'home', viewTitle: '' })
    }
    void this.refresh()
  },

  tapHomeRow(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.key as string
    const row = HOME_ROWS.find((item) => item.key === key)
    if (!row) {
      return
    }
    if (BIZ_ROWS.some((item) => item.key === key)) {
      this.setData({ view: 'orders', viewTitle: VIEW_TITLE.orders, bizKey: key, bizName: row.name, loadingOrders: true })
    } else {
      this.setData({ view: key as View, viewTitle: VIEW_TITLE[key] || '' })
    }
    void this.refresh()
  },

  async refresh() {
    const view = this.data.view
    if (view === 'orders') {
      await this.loadOrders()
    } else if (view === 'titles' || view === 'titleForm') {
      await this.loadTitles()
    } else if (view === 'record') {
      await this.loadRecords()
    }
  },

  async loadOrders() {
    this.setData({ loadingOrders: true })
    const data = (await invListOrdersCloud().catch(() => null)) || { items: [] }
    const rows: OrderRow[] = (data.items || [])
      .filter((order) => (order.biz || 'TEA') === this.data.bizKey)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        biz: order.biz || 'TEA',
        amount: Number((order as { amount?: number }).amount ?? 0),
        createdAt: order.createdAt,
        picked: this._prefillOrderId === order.id,
      }))
    this._prefillOrderId = ''
    this.setData({ orders: rows, loadingOrders: false })
    this.recount()
  },

  recount() {
    const picked = this.data.orders.filter((order) => order.picked)
    const amount = picked.reduce((sum, order) => sum + order.amount, 0).toFixed(2)
    this.setData({
      pickedCount: picked.length,
      pickedAmount: amount,
      allPicked: picked.length > 0 && picked.length === this.data.orders.length,
    })
  },

  pickOrder(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    this.setData({ orders: this.data.orders.map((order) => (order.id === id ? { ...order, picked: !order.picked } : order)) })
    this.recount()
  },

  toggleAll() {
    const next = !this.data.allPicked
    this.setData({ orders: this.data.orders.map((order) => ({ ...order, picked: next })) })
    this.recount()
  },

  /* 扫码开票 */
  openScan() {
    this.setData({ scanOpen: true })
  },

  closeScan() {
    this.setData({ scanOpen: false })
  },

  doScan() {
    this.setData({ scanOpen: false })
    wx.scanCode({
      success: () => wx.showToast({ title: '已识别小票，请选择订单', icon: 'none' }),
      fail: () => wx.showToast({ title: '扫码取消', icon: 'none' }),
    })
  },

  /* 下一步 → 选抬头 → 提交 */
  async nextStep() {
    if (!this.data.pickedCount || this.data.submitting) {
      return
    }
    await this.loadTitles()
    if (!this.data.titles.length) {
      wx.showToast({ title: '请先添加常用抬头', icon: 'none' })
      this.setData({ view: 'titleForm', viewTitle: VIEW_TITLE.titleForm })
      return
    }
    const def = this.data.titles.find((t) => t.isDefault) || this.data.titles[0]
    this.setData({ titleSheet: true, activeTitleId: def.id })
  },

  async loadTitles() {
    const data = (await invListTitlesCloud().catch(() => null)) || { items: [] }
    this.setData({ titles: data.items || [] })
  },

  pickTitle(event: WechatMiniprogram.BaseEvent) {
    this.setData({ activeTitleId: event.currentTarget.dataset.id as string })
  },

  closeTitleSheet() {
    this.setData({ titleSheet: false })
  },

  async submitApply() {
    const title = this.data.titles.find((t) => t.id === this.data.activeTitleId)
    if (!title || this.data.submitting) {
      return
    }
    this.setData({ submitting: true })
    try {
      await invApplyCloud({
        orderIds: this.data.orders.filter((o) => o.picked).map((o) => o.id),
        title: title.name,
        taxNo: title.taxNo || '',
      })
      this.setData({ submitting: false, titleSheet: false })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      this.setData({ view: 'record', viewTitle: VIEW_TITLE.record })
      void this.refresh()
    } catch (error) {
      this.setData({ submitting: false })
      const message = error instanceof Error ? String(error.message || error).replace('Error: ', '') : '提交失败'
      wx.showToast({ title: message, icon: 'none' })
    }
  },

  /* 记录 */
  async loadRecords() {
    const data = (await invListRecordsCloud().catch(() => null)) || { items: [] }
    const records = ((data.items || []) as Array<Record<string, unknown>>).map((doc) => ({
      id: String(doc.id || ''),
      amount: Number(doc.amount || 0),
      statusText: STATUS_TEXT[String(doc.status || 'PENDING')] || '待开具',
      orderNumbers: (doc.orderNumbers as string[]) || [],
      date: String(doc.createdAt || '').slice(0, 10),
      invoiceNo: doc.invoiceNo ? String(doc.invoiceNo) : '',
    }))
    this.setData({ records })
  },

  /* 抬头管理 */
  newTitle() {
    this.setData({ view: 'titleForm', viewTitle: VIEW_TITLE.titleForm, form: emptyForm() })
  },

  editTitle(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    const title = this.data.titles.find((t) => t.id === id)
    if (!title) {
      return
    }
    this.setData({
      view: 'titleForm',
      viewTitle: VIEW_TITLE.titleForm,
      form: {
        id: title.id,
        titleType: title.titleType || 'PERSONAL',
        name: title.name,
        taxNo: title.taxNo || '',
        address: title.address || '',
        phone: title.phone || '',
        bank: title.bank || '',
        bankAccount: title.bankAccount || '',
        isDefault: !!title.isDefault,
      },
    })
  },

  async removeTitle(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    const res = await wx.showModal({ title: '删除抬头', content: '确认删除该常用抬头？' })
    if (!res.confirm) {
      return
    }
    await invDeleteTitleCloud(id).catch(() => null)
    void this.loadTitles()
  },

  wechatImport() {
    wx.showToast({ title: '微信导入即将开放', icon: 'none' })
  },

  setType(event: WechatMiniprogram.BaseEvent) {
    this.setData({ 'form.titleType': event.currentTarget.dataset.type as 'COMPANY' | 'PERSONAL' })
  },

  onField(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const field = event.currentTarget.dataset.field as string
    this.setData({ [`form.${field}`]: event.detail.value } as never)
  },

  toggleDefault() {
    this.setData({ 'form.isDefault': !this.data.form.isDefault })
  },

  async saveForm() {
    const form = this.data.form
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写抬头名称', icon: 'none' })
      return
    }
    if (form.titleType === 'COMPANY' && !form.taxNo.trim()) {
      wx.showToast({ title: '企业抬头请填写税号', icon: 'none' })
      return
    }
    try {
      await invSaveTitleCloud({ ...form, name: form.name.trim() })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ view: 'titles', viewTitle: VIEW_TITLE.titles })
      void this.loadTitles()
    } catch (_error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },
})
