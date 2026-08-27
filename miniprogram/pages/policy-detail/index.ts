import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'
import { getPolicyCloud } from '../../utils/cloud'

Page({
  behaviors: [pageLookBehavior],

  data: {
    title: '',
    version: '',
    updatedAt: '',
    nodes: '' as string,
  },

  onShow() {
    applyPageLook(this, getCurrentMember())
  },

  async onLoad(query: Record<string, string | undefined>) {
    const id = query.id || ''
    try {
      const policy = (await getPolicyCloud(id).catch(() => null)) || { title: '', version: '', updatedAt: '', contentHtml: '', sections: [] as unknown[] }
      /* sections 数组序列化为富文本；否则用 contentHtml */
      let html = policy.contentHtml || ''
      if (!html && Array.isArray(policy.sections)) {
        html = (policy.sections as Array<{ heading?: string; body?: string }>)
          .map((section) => `<h3>${section.heading || ''}</h3><p>${section.body || ''}</p>`)
          .join('')
      }
      this.setData({
        title: policy.title,
        version: policy.version || '',
        updatedAt: policy.updatedAt || '',
        nodes: html || '暂无内容',
      })
      if (policy.title) wx.setNavigationBarTitle({ title: policy.title })
    } catch (error) {
      this.setData({ nodes: '加载失败' })
    }
  },
})
