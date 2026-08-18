/* 菜品图方形裁切：选图后居中裁成正方形并压到 MAX_SIDE 内
 * 失败任何一步都回退原图（不阻塞发布流程） */
const MAX_SIDE = 1080

export const cropImageToSquare = (src: string): Promise<string> => {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src,
      success: (info) => {
        const side = Math.min(info.width, info.height)
        const outSide = Math.min(side, MAX_SIDE)

        if (info.width === info.height && side <= MAX_SIDE) {
          resolve(src)
          return
        }

        try {
          const canvas = wx.createOffscreenCanvas({ type: '2d', width: outSide, height: outSide })
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
          const img = canvas.createImage()

          img.onload = () => {
            const sx = (info.width - side) / 2
            const sy = (info.height - side) / 2
            ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide)

            wx.canvasToTempFilePath({
              canvas,
              fileType: 'jpg',
              quality: 0.9,
              success: (result) => resolve(result.tempFilePath),
              fail: () => resolve(src),
            } as WechatMiniprogram.CanvasToTempFilePathOption)
          }
          img.onerror = () => resolve(src)
          img.src = src
        } catch {
          resolve(src)
        }
      },
      fail: () => resolve(src),
    })
  })
}
