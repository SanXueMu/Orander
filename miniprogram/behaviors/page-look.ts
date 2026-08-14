import { buildPageLook } from '../utils/orander'
import type { Member, PageLook } from '../utils/orander'

type PageLike = { setData: (data: Partial<PageLook>, callback?: () => void) => void }

export const pageLookBehavior = Behavior({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#2b1d12',
    navBackground: '#faf6f0',
  },
})

export const applyPageLook = (page: PageLike, member: Member | null) => {
  page.setData(buildPageLook(member))
}
