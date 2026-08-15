import { buildPageLook } from '../utils/orander'
import type { Member, PageLook } from '../utils/orander'

type PageLike = { setData: (data: Partial<PageLook>, callback?: () => void) => void }

export const pageLookBehavior = Behavior({
  data: {
    themeClass: 'theme-amber',
    fontClass: 'font-modern',
    navColor: '#17181C',
    navBackground: 'rgba(255,255,255,0.78)',
  },
})

export const applyPageLook = (page: PageLike, member: Member | null) => {
  page.setData(buildPageLook(member))
}
