import {
  priceUnit,
  type SelectionRef,
  type SpecGroup,
  type Spu,
} from '../../utils/xicha'

/**
 * 规格选择弹窗（喜茶范式）
 * props: spu, visible
 * 单选组直接点选；多选组可叠加（加料）。底部合计 + 步进数量 + 加入购物车。
 */
Component({
  properties: {
    spu: { type: Object, value: null as unknown as Spu },
    visible: { type: Boolean, value: false },
  },

  data: {
    groups: [] as SpecGroup[],
    picks: {} as Record<string, string[]>, // groupId -> optionIds[]
    quantity: 1,
    unitPriceText: '¥0.00',
    totalText: '¥0.00',
    specSummary: '',
  },

  observers: {
    'spu, visible'(spu: Spu | null, visible: boolean) {
      if (!visible || !spu || !spu.specGroups || !spu.specGroups.length) {
        return
      }
      /* 默认选中：每组第一个单选项 */
      const picks: Record<string, string[]> = {}
      spu.specGroups.forEach((group) => {
        if (!group.multiple && group.options.length > 0) {
          picks[group.id] = [group.options[0].id]
        } else {
          picks[group.id] = []
        }
      })
      this.setData({ groups: spu.specGroups, picks, quantity: 1 }, () => this.recalc())
    },
  },

  methods: {
    flatSelections(): SelectionRef[] {
      const result: SelectionRef[] = []
      const picks = this.data.picks as Record<string, string[]>
      this.data.groups.forEach((group) => {
        ;(picks[group.id] || []).forEach((optionId) => {
          const option = group.options.find((item) => item.id === optionId)
          if (option) {
            result.push({
              groupId: group.id,
              groupName: group.name,
              optionId: option.id,
              optionName: option.name,
              extraPrice: Number(option.extraPrice) || 0,
            })
          }
        })
      })
      return result
    },

    recalc() {
      const spu = this.data.spu as Spu
      if (!spu) return
      const selections = this.flatSelections()
      const unit = priceUnit(spu.basePrice, selections)
      const total = Number((unit * this.data.quantity).toFixed(2))
      this.setData({
        unitPriceText: `¥${unit.toFixed(2)}`,
        totalText: `¥${total.toFixed(2)}`,
        specSummary: selections.map((ref) => ref.optionName).join('/'),
      })
    },

    tapOption(event: WechatMiniprogram.BaseEvent) {
      const { group, option } = event.currentTarget.dataset as { group: string; option: string }
      const specGroup = this.data.groups.find((item) => item.id === group)
      if (!specGroup) return
      const current = [...(this.data.picks[group] || [])]
      if (specGroup.multiple) {
        const index = current.indexOf(option)
        if (index >= 0) {
          current.splice(index, 1)
        } else {
          current.push(option)
        }
      } else {
        /* 单选组：重复点同一个不做取消（必须有一档） */
        current.splice(0, current.length, option)
      }
      this.setData({ [`picks.${group}`]: current }, () => this.recalc())
      wx.vibrateShort({ type: 'light' })
    },

    increaseQty() {
      if (this.data.quantity >= 99) return
      this.setData({ quantity: this.data.quantity + 1 }, () => this.recalc())
    },

    decreaseQty() {
      if (this.data.quantity <= 1) return
      this.setData({ quantity: this.data.quantity - 1 }, () => this.recalc())
    },

    closePopup() {
      this.triggerEvent('close')
    },

    stopBubble() {
      /* 阻止冒泡占位 */
    },

    confirmAdd() {
      const spu = this.data.spu as Spu
      if (!spu) return
      const selections = this.flatSelections()
      /* 校验单选组都已选 */
      const missing = this.data.groups.find(
        (group) => !group.multiple && !(this.data.picks[group.id] || []).length,
      )
      if (missing) {
        wx.showToast({ title: `请选择${missing.name}`, icon: 'none' })
        return
      }

      const unit = priceUnit(spu.basePrice, selections)
      this.triggerEvent('add', {
        line: {
          spuId: spu.id,
          name: spu.name,
          image: spu.image,
          basePrice: spu.basePrice,
          quantity: this.data.quantity,
          selections,
        },
        unitPrice: unit,
        totalText: `¥${(unit * this.data.quantity).toFixed(2)}`,
      })
      this.triggerEvent('close')
    },
  },
})
