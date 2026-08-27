import { getCurrentMember, isVisitorSession } from '../../utils/orander'
import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'

interface FloorBlock {
  key: string
  title: string
  copy: string
}

const FLOORS: FloorBlock[] = [
  { key: 'new', title: '灵感上新', copy: '本周新到的灵感好物' },
  { key: 'bottle', title: '喜茶瓶装', copy: '轻便瓶装，随身灵感' },
  { key: 'gift', title: '茶礼盒', copy: '送得出手的心意' },
  { key: 'goods', title: '灵感周边', copy: '把灵感穿在身上' },
]

Page({
  behaviors: [pageLookBehavior],

  data: {
    floors: FLOORS,
    activeFloor: 'new',
  },

  onShow() {
    const profile = isVisitorSession() ? null : getCurrentMember()
    applyPageLook(this, profile)
  },

  onFloorTap(event: WechatMiniprogram.BaseEvent) {
    const key = event.currentTarget.dataset.key as string
    this.setData({ activeFloor: key })
  },
})
