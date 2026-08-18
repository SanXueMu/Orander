/* 菜品图方形裁切：选图后居中裁成正方形并压到 MAX_SIDE 内
 * 失败任何一步都回退原图（不阻塞发布流程）
 * 注：微信类型库未覆盖 createOffscreenCanvas 2d 模式的完整签名，这里用结构化 any */
const MAX_SIDE = 1080

/* eslint-disable @typescript-eslint/no-explicit-any */
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
          const canvas: any = (wx.createOffscreenCanvas as any)({ type: '2d', width: outSide, height: outSide })
          canvas.width = outSide
          canvas.height = outSide

          const ctx: any = canvas.getContext('2d')
          const img: any = canvas.createImage()

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
