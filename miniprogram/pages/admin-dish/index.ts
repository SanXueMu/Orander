import { deleteDish, getAdminToken, getDishCoverStyle, getDishes, getMonogram, isAdminSession, saveDish } from '../../utils/orander'
import { fetchCloudDishes, initCloud, publishSingleDish } from '../../utils/cloud'
import { pageLookBehavior } from '../../behaviors/page-look'

const DEFAULT_DISH_IMAGE = ''

Page({
  behaviors: [pageLookBehavior],

  data: {
    dishId: '',
    focusedField: '',
    dishName: '',
    dishCategory: '',
    dishPrice: '',
    dishDescription: '',
    dishImage: '',
    showDishImage: false,
    dishImageLabel: 'DI',
    dishImageStyle: getDishCoverStyle('dish'),
    dishAvailable: true,
    editing: false,
    publishing: false,
    cropVisible: false,
    cropSrc: '',
    cropViewW: 560,
    cropViewH: 560,
    cropXInit: 0,
    cropYInit: 0,
    cropScaleInit: 1,
  },

  /* 裁切过程中的手势态（不进 data，避免渲染抖动） */
  cropImgW: 0,
  cropImgH: 0,
  cropPos: { x: 0, y: 0 },
  cropScaleVal: 1,
  viewportSideRpx: 560,
  pxPerRpx: 0.5,

  onLoad(options: Record<string, string>) {
    if (!isAdminSession()) {
      wx.reLaunch({
        url: '/pages/index/index',
      })
      return
    }

    const dishId = options.id || ''
    const presetCategory = options.category ? decodeURIComponent(options.category) : ''

    if (!dishId) {
      this.setData({
        dishCategory: presetCategory,
        dishImageLabel: getMonogram(this.data.dishName || 'DI', 'DI'),
        dishImageStyle: getDishCoverStyle('draft-dish'),
      })
      return
    }

    const dish = getDishes().find((item) => item.id === dishId)
    if (!dish) {
      wx.showToast({
        title: '菜品不存在',
        icon: 'none',
      })
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 400)
      return
    }

    this.setData({
      dishId: dish.id,
      dishName: dish.name,
      dishCategory: dish.category,
      dishPrice: `${dish.price}`,
      dishDescription: dish.description,
      dishImage: dish.image,
      showDishImage: !!dish.image,
      dishImageLabel: getMonogram(dish.name, 'DI'),
      dishImageStyle: getDishCoverStyle(dish.id),
      dishAvailable: !dish.soldOut,
      editing: true,
    })
  },

  onFieldFocus(event: WechatMiniprogram.BaseEvent) {
    this.setData({ focusedField: event.currentTarget.dataset.field as string })
  },

  onFieldBlur() {
    this.setData({ focusedField: '' })
  },

  onDishNameInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    const dishName = detail.value || ''
    this.setData({
      dishName,
      dishImageLabel: getMonogram(dishName || 'DI', 'DI'),
      dishImageStyle: getDishCoverStyle(this.data.dishId || dishName || 'dish'),
    })
  },

  onDishCategoryInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({ dishCategory: detail.value || '' })
  },

  onDishPriceInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({ dishPrice: detail.value || '' })
  },

  onDishDescriptionInput(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { value?: string }
    this.setData({ dishDescription: detail.value || '' })
  },

  chooseDishImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (result) => {
        const original = result.tempFiles[0] && result.tempFiles[0].tempFilePath
        if (!original) {
          return
        }
        this.openCropModal(original)
      },
    })
  },

  /* 打开裁切取景框：图片以 cover 方式铺满正方形取景框，初始居中 */
  openCropModal(src: string) {
    wx.getImageInfo({
      src,
      success: (info) => {
        const side = this.viewportSideRpx
        const ratio = info.width / info.height
        const viewW = ratio >= 1 ? Math.round(side * ratio) : side
        const viewH = ratio >= 1 ? side : Math.round(side / ratio)

        this.cropImgW = info.width
        this.cropImgH = info.height
        this.cropPos = { x: 0, y: 0 }
        this.cropScaleVal = 1

        this.setData({
          cropSrc: src,
          cropVisible: true,
          cropViewW: viewW,
          cropViewH: viewH,
          cropXInit: (side - viewW) / 2,
          cropYInit: (side - viewH) / 2,
          cropScaleInit: 1,
        })
      },
      fail: () => {
        /* 读不出尺寸就不裁切，直接用原图 */
        this.setData({ dishImage: src, showDishImage: true, cropVisible: false })
      },
    })
  },

  noop() {},

  onCropChange(event: WechatMiniprogram.CustomEvent) {
    this.cropPos = { x: event.detail.x, y: event.detail.y }
  },

  onCropScale(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail as { x: number; y: number; scale: number }
    this.cropScaleVal = detail.scale
    this.cropPos = { x: detail.x, y: detail.y }
  },

  closeCrop() {
    this.setData({ cropVisible: false })
  },

  useOriginalImage() {
    this.setData({
      dishImage: this.data.cropSrc,
      showDishImage: true,
      cropVisible: false,
    })
  },

  /* 确认裁切：按当前平移/缩放反推源图上的正方形区域，页面内 canvas 绘制导出 */
  async confirmCrop() {
    const windowInfo = (wx as unknown as { getWindowInfo?: () => { windowWidth: number } }).getWindowInfo
      ? (wx as unknown as { getWindowInfo: () => { windowWidth: number } }).getWindowInfo()
      : { windowWidth: 375 }
    const pxPerRpx = windowInfo.windowWidth / 750

    const imgW = this.cropImgW
    const imgH = this.cropImgH
    if (!imgW || !imgH) {
      this.useOriginalImage()
      return
    }

    const sideRpx = this.viewportSideRpx
    const ratio = imgW / imgH
    const baseW = ratio >= 1 ? sideRpx * ratio : sideRpx
    const scale = this.cropScaleVal
    const viewWpx = baseW * pxPerRpx * scale
    const viewHpx = (baseW / ratio) * pxPerRpx * scale

    let sx = (-this.cropPos.x / viewWpx) * imgW
    let sy = (-this.cropPos.y / viewHpx) * imgH
    let side = (sideRpx * pxPerRpx / viewWpx) * imgW
    side = Math.min(side, imgW, imgH)
    sx = Math.max(0, Math.min(sx, imgW - side))
    sy = Math.max(0, Math.min(sy, imgH - side))

    const outSide = Math.max(1, Math.min(1080, Math.round(side)))

    wx.showLoading({ title: '裁切中' })
    wx.createSelectorQuery()
      .select('#cropCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && (res[0] as { node?: unknown }).node
        if (!canvas) {
          wx.hideLoading()
          this.useOriginalImage()
          return
        }

        const target = canvas as unknown as { width: number; height: number; getContext: (t: string) => any; createImage: () => any }
        target.width = outSide
        target.height = outSide
        const ctx = target.getContext('2d')
        const img = target.createImage()

        img.onload = () => {
          ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide)
          wx.canvasToTempFilePath({
            canvas: target,
            fileType: 'jpg',
            quality: 0.9,
            success: (result) => {
              wx.hideLoading()
              this.setData({
                dishImage: result.tempFilePath,
                showDishImage: true,
                cropVisible: false,
              })
            },
            fail: () => {
              wx.hideLoading()
              this.useOriginalImage()
            },
          })
        }
        img.onerror = () => {
          wx.hideLoading()
          this.useOriginalImage()
        }
        img.src = this.data.cropSrc
      })
  },

  clearDishImage() {
    this.setData({
      dishImage: '',
      showDishImage: false,
    })
  },

  chooseStatus(event: WechatMiniprogram.BaseEvent) {
    const status = event.currentTarget.dataset.status as string
    this.setData({
      dishAvailable: status === 'available',
    })
  },

  async saveDishDraft() {
    const name = this.data.dishName.trim()
    const category = this.data.dishCategory.trim()
    const description = this.data.dishDescription.trim()
    const price = Number(this.data.dishPrice)

    if (!name || !category || !description || Number.isNaN(price)) {
      wx.showToast({
        title: '请补全信息',
        icon: 'none',
      })
      return
    }

    const existingDish = this.data.dishId
      ? getDishes().find((item) => item.id === this.data.dishId)
      : null

    const nextDish = {
      id: this.data.dishId || `dish-${Date.now()}`,
      name,
      category,
      price,
      description,
      image: this.data.dishImage || (existingDish ? existingDish.image : DEFAULT_DISH_IMAGE),
      tags: existingDish ? existingDish.tags : [],
      featured: existingDish ? existingDish.featured : false,
      soldOut: !this.data.dishAvailable,
    }

    saveDish(nextDish)

    /* 云可用时直接发布，一步到位；不可用则仅本地保存 */
    if (initCloud()) {
      this.setData({ publishing: true })
      wx.showLoading({ title: '发布中' })
      try {
        const saved = await publishSingleDish(nextDish, getAdminToken())
        wx.hideLoading()
        if (saved) {
          await fetchCloudDishes()
          wx.showToast({ title: '已发布', icon: 'success' })
        } else {
          wx.showToast({ title: '本地已存，云端发布失败', icon: 'none' })
        }
      } finally {
        this.setData({ publishing: false })
      }
    } else {
      wx.showToast({
        title: '已保存到本机',
        icon: 'success',
      })
    }

    setTimeout(() => {
      wx.navigateBack({ delta: 1 })
    }, 300)
  },

  removeDishDraft() {
    if (!this.data.dishId) {
      wx.navigateBack({ delta: 1 })
      return
    }

    wx.showModal({
      title: '删除菜品',
      content: '确定删除当前菜品吗？',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        deleteDish(this.data.dishId)
        wx.navigateBack({ delta: 1 })
      },
    })
  },
})
