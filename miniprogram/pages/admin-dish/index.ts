import { deleteDish, getAdminToken, getDishCoverStyle, getDishes, getMonogram, isAdminSession, saveDish } from '../../utils/orander'
import { fetchCloudDishes, initCloud, publishSingleDish } from '../../utils/cloud'
import { cropImageToSquare } from '../../utils/image-crop'
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
  },

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
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (result) => {
        const original = result.tempFilePaths[0] || ''
        if (!original) {
          return
        }

        wx.showLoading({ title: '处理图片' })
        const squareImage = await cropImageToSquare(original)
        wx.hideLoading()

        this.setData({
          dishImage: squareImage,
          showDishImage: true,
        })

        if (squareImage !== original) {
          wx.showToast({ title: '已方形裁切', icon: 'none' })
        }
      },
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
