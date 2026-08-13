import { ensureSeedData } from './utils/orander'

App({
  globalData: {},
  onLaunch() {
    ensureSeedData()
  },
})
