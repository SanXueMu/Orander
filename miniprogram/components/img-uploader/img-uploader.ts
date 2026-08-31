Component({
  properties: {
    value: { type: String, value: '' },
    tips: { type: String, value: '上传图片' },
    folder: { type: String, value: 'assets' },
  },
  data: { uploading: false },
  methods: {
    async onPick() {
      if (this.data.uploading) return
      if (this.data.value) {
        wx.previewImage({ urls: [this.data.value] })
        return
      }
      try {
        const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
          wx.showToast({ title: '图片需 ≤2MB', icon: 'none' })
          return
        }
        this.setData({ uploading: true })
        const ext = (file.tempFilePath.split('.').pop() || 'png').toLowerCase()
        const cloudPath = `orander/${this.data.folder}/${Date.now()}.${ext}`
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: file.tempFilePath })
        this.triggerEvent('change', { value: up.fileID })
        wx.showToast({ title: '已上传', icon: 'success' })
      } catch (error) {
        console.warn('upload failed', error)
        wx.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        this.setData({ uploading: false })
      }
    },
    onClear() {
      this.triggerEvent('change', { value: '' })
    },
  },
})
