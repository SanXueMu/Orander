import { ensureSeedData } from './utils/orander'
import { initCloud } from './utils/cloud'

App({
  globalData: {},
  onLaunch() {
    initCloud()
    ensureSeedData()
  },
})
