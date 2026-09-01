import { applyPageLook, pageLookBehavior } from '../../behaviors/page-look'
import { getCurrentMember } from '../../utils/orander'

interface QrCtx {
  fillStyle: string
  fillRect: (x: number, y: number, w: number, h: number) => void
  scale: (x: number, y: number) => void
}

interface QrCanvasNode {
  getContext: (type: string) => QrCtx
  width: number
  height: number
}

const N = 25

Page({
  behaviors: [pageLookBehavior],

  data: {
    nickname: '访客',
    levelName: '',
    navColor: '',
    navBackground: '',
  },

  _canvas: null as QrCanvasNode | null,
  _seed: '',

  onShow() {
    const member = getCurrentMember()
    applyPageLook(this, member)
    this.setData({ navColor: '#1a1a1a', navBackground: '#ffffff' })
    if (member) {
      this.setData({ nickname: member.nickname || '访客', levelName: member.levelName || '' })
    }
    this._seed = (member && (member.openId || member.id)) || this.data.nickname || 'orander'
    this.drawQr(this._seed)
  },

  drawQr(seed: string) {
    const query = this.createSelectorQuery()
    query.select('#qr').fields({ node: true, size: true } as never, (res) => {
      const entry = res as unknown as { node: QrCanvasNode; width: number; height: number }
      if (!entry || !entry.node) {
        return
      }
      const canvas = entry.node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const size = entry.width || 360
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#1a1a1a'

      let h = 2166136261
      for (let i = 0; i < seed.length; i += 1) {
        h ^= seed.charCodeAt(i)
        h = Math.imul(h, 16777619) >>> 0
      }
      const rand = () => {
        h = (Math.imul(h, 1664525) + 1013904223) >>> 0
        return h / 4294967296
      }

      const inFinder = (r: number, c: number) =>
        (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8)
      const cell = size / N
      for (let r = 0; r < N; r += 1) {
        for (let c = 0; c < N; c += 1) {
          if (inFinder(r, c)) {
            continue
          }
          if (rand() > 0.52) {
            ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5)
          }
        }
      }

      const finder = (fr: number, fc: number) => {
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(fc * cell, fr * cell, cell * 7, cell * 7)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(fc * cell + cell, fr * cell + cell, cell * 5, cell * 5)
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(fc * cell + cell * 2, fr * cell + cell * 2, cell * 3, cell * 3)
      }
      finder(0, 0)
      finder(0, N - 7)
      finder(N - 7, 0)

      this._canvas = canvas
    })
    query.exec()
  },

  savePic() {
    const canvas = this._canvas
    if (!canvas) {
      wx.showToast({ title: '二维码尚未生成', icon: 'none' })
      return
    }
    wx.canvasToTempFilePath({
      canvas: canvas as unknown as WechatMiniprogram.Canvas,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }),
        })
      },
      fail: () => wx.showToast({ title: '导出失败，请重试', icon: 'none' }),
    })
  },
})
