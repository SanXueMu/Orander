import { getAdminToken } from '../../utils/orander'
import { fetchCatalogCloud, adminSaveSpuCloud, adminDeleteSpuCloud } from '../../utils/cloud'
import type { Spu } from '../../utils/xicha'

type GroupDraft = { name: string; type: 'single' | 'multi'; optionsText: string }

type ServerGroup = { id: string; name: string; single: boolean; options: Array<{ id: string; name: string; price: number }> }

const toDraft = (spu: Spu): Array<{ name: string; type: 'single' | 'multi'; optionsText: string }> =>
  ((spu.specGroups || []) as unknown as ServerGroup[]).map((group) => ({
    name: group.name || '',
    type: (group.single === false ? 'multi' : 'single') as 'single' | 'multi',
    optionsText: (group.options || []).map((opt) => `${opt.name || ''},${Number(opt.price || 0)}`).join('\n'),
  }))

Page({
  data: {
    spuId: '',
    name: '',
    basePrice: '',
    description: '',
    catNames: [] as string[],
    catIds: [] as string[],
    catIndex: 0,
    groups: [] as GroupDraft[],
    saving: false,
  },

  async onLoad(query: Record<string, string | undefined>) {
    if (!getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index' })
      return
    }
    const data = await fetchCatalogCloud()
    if (!data) {
      wx.showToast({ title: '目录加载失败', icon: 'none' })
      return
    }
    const cats = data.categories || []
    const spus = data.spus || []
    let spu: Spu | undefined
    let presetCat = query.cat || ''
    if (query.id) {
      spu = spus.find((item) => item.id === query.id)
      presetCat = spu ? spu.categoryId : presetCat
    }
    const catIndex = Math.max(0, cats.findIndex((cat) => cat.id === presetCat))
    this.setData({
      spuId: query.id || '',
      name: spu ? spu.name : '',
      basePrice: spu ? String(spu.basePrice || '') : '',
      description: spu ? spu.description || '' : '',
      catNames: cats.map((cat) => cat.name),
      catIds: cats.map((cat) => cat.id),
      catIndex,
      groups: spu ? toDraft(spu) : [],
    })
  },

  onInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as string
    this.setData({ [field]: event.detail.value } as Record<string, never>)
  },

  onCatChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ catIndex: Number(event.detail.value) })
  },

  onGroupInput(event: WechatMiniprogram.Input) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field as 'name' | 'optionsText'
    const groups = this.data.groups.slice()
    groups[index] = { ...groups[index], [field]: event.detail.value }
    this.setData({ groups })
  },

  onTypeChange(event: WechatMiniprogram.Touch) {
    const index = Number(event.currentTarget.dataset.index)
    const type = event.currentTarget.dataset.type as 'single' | 'multi'
    const groups = this.data.groups.slice()
    groups[index] = { ...groups[index], type }
    this.setData({ groups })
  },

  addGroup() {
    this.setData({ groups: this.data.groups.concat([{ name: '', type: 'single', optionsText: '' }]) })
  },

  delGroup(event: WechatMiniprogram.Touch) {
    const index = Number(event.currentTarget.dataset.index)
    const groups = this.data.groups.slice()
    groups.splice(index, 1)
    this.setData({ groups })
  },

  async save() {
    const token = getAdminToken()
    if (!token || this.data.saving) { return }
    const name = this.data.name.trim()
    const basePrice = Number(this.data.basePrice)
    if (!name || !(basePrice > 0)) {
      wx.showToast({ title: '请填名称和价格', icon: 'none' })
      return
    }
    const specGroups: ServerGroup[] = this.data.groups
      .filter((group) => group.name.trim())
      .map((group, groupIndex) => ({
        id: `g${groupIndex + 1}`,
        name: group.name.trim(),
        single: group.type !== 'multi',
        options: group.optionsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, optIndex) => {
            const [optName = '', priceText = '0'] = line.split(',')
            return { id: `g${groupIndex + 1}o${optIndex + 1}`, name: optName.trim(), price: Number(priceText) || 0 }
          }),
      }))
      .filter((group) => group.options.length)
    this.setData({ saving: true })
    await adminSaveSpuCloud(token, {
      id: this.data.spuId || undefined,
      name,
      basePrice,
      description: this.data.description.trim(),
      categoryId: this.data.catIds[this.data.catIndex] || '',
      specGroups,
    })
    this.setData({ saving: false })
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 500)
  },

  remove() {
    const token = getAdminToken()
    if (!token || !this.data.spuId) { return }
    wx.showModal({
      title: '删除商品',
      content: '确认删除该商品？',
      success: async (res) => {
        if (!res.confirm) { return }
        await adminDeleteSpuCloud(token, this.data.spuId)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      },
    })
  },
})
