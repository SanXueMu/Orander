import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'

/* 与后端 cloudfunctions/orander/modules/member.js LEVELS 保持一致 */
const LEVELS = [
  { code: 'V0', name: '新客', threshold: 0, perk: '注册即享新人礼' },
  { code: 'V1', name: '茶友', threshold: 100, perk: '周一免配送费资格' },
  { code: 'V2', name: '茶咖', threshold: 300, perk: '会员日 88 折' },
  { code: 'V3', name: '茶痴', threshold: 600, perk: '新品优先试饮' },
  { code: 'V4', name: '灵感家', threshold: 1000, perk: '专属客服 + 生日礼' },
]

interface LevelCard {
  code: string
  name: string
  threshold: number
  range: string
  perk: string
  black: boolean
  isCurrent: boolean
  reached: boolean
  gap: string
}

Page({
  behaviors: [pageLookBehavior],

  data: {
    growthValue: 0,
    cards: [] as LevelCard[],
    current: 0,
    rulesOpen: false,
    navColor: '',
    navBackground: '',
  },

  onShow() {
    const member = getCurrentMember()
    applyPageLook(this, member)
    this.setData({ navColor: '#1a1a1a', navBackground: '#ffffff' })

    const growth = member ? Number(member.growthValue || 0) : 0
    const levelCode = (member && member.levelCode) || 'V0'
    const currentIndex = Math.max(0, LEVELS.findIndex((item) => item.code === levelCode))
    const cards: LevelCard[] = LEVELS.map((item, index) => ({
      code: item.code,
      name: item.name,
      threshold: item.threshold,
      range:
        index === LEVELS.length - 1
          ? `${item.threshold} 以上`
          : `${item.threshold} - ${LEVELS[index + 1].threshold - 1}`,
      perk: item.perk,
      black: index === LEVELS.length - 1,
      isCurrent: index === currentIndex,
      reached: index < currentIndex,
      gap: index === currentIndex || growth >= item.threshold ? '' : String(item.threshold - growth),
    }))
    this.setData({ growthValue: growth, cards, current: currentIndex })
  },

  onSwiper(event: WechatMiniprogram.SwiperChange) {
    this.setData({ current: event.detail.current })
  },

  prev() {
    if (this.data.current > 0) {
      this.setData({ current: this.data.current - 1 })
    }
  },

  next() {
    if (this.data.current < this.data.cards.length - 1) {
      this.setData({ current: this.data.current + 1 })
    }
  },

  toggleRules() {
    this.setData({ rulesOpen: !this.data.rulesOpen })
  },
})
