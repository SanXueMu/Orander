/* 会员福利前端文案库（与云端 benefits 集合 code 对齐；云端缺行时本地 meta 兜底展示） */

export type BenefitLayout = 'NEWBIE' | 'MONDAY' | 'GOLDEN' | 'WARM' | 'STUDENT' | 'GENERIC'

export interface BenefitMeta {
  code: string
  name: string
  tagline: string
  description: string
  perks: string[]
  tone: 'gold' | 'green' | 'warm' | 'ink'
  layout: BenefitLayout
}

export const BENEFIT_META: BenefitMeta[] = [
  {
    code: 'GOLD_CARD',
    name: '金喜卡',
    tagline: '一张卡，杯杯 8.8 折',
    description: '金喜卡是 Orander GO 的付费会员卡。开卡后全单 88 折自动生效，卡面米白金寓意「喜上眉梢」，权益 90 天有效。',
    perks: ['全单 8.8 折', '首杯立减 ¥8', '喜外送免运费'],
    tone: 'gold',
    layout: 'GOLDEN',
  },
  {
    code: 'MONDAY_FREE_FEE',
    name: '周一免配送费',
    tagline: '每周一，配送费我们请',
    description: 'V1 茶友及以上会员，每周一下单（喜外送）自动免配送费，无需领券。成长值达到 100 自动升级 V1，升级后次周一生效。',
    perks: ['每周一生效', '喜外送订单适用', '自动享受无需领取'],
    tone: 'green',
    layout: 'MONDAY',
  },
  {
    code: 'NEWBIE_20',
    name: 'App 新人专享',
    tagline: '20 元券包，即领即用',
    description: '新注册会员一键领取 20 元新人券包（4/6/10 元三张），下单时自动匹配可用券抵扣，领取后 30 天内有效。',
    perks: ['3 张券共 ¥20', '领取后 30 天有效', '下单自动抵扣'],
    tone: 'warm',
    layout: 'NEWBIE',
  },
  {
    code: 'WARM_TEA',
    name: '暖心为你',
    tagline: '每月 8.8 折，女生专享',
    description: '暖饮季特别企划。每月可领一张指定热饮 8.8 折券，领取后 30 天内有效，可邀好友同领。',
    perks: ['每月可领 1 张', '指定热饮适用', '可邀好友同领'],
    tone: 'warm',
    layout: 'WARM',
  },
  {
    code: 'STUDENT_CARD',
    name: '学子卡',
    tagline: '学生认证，指定饮品第二杯半价',
    description: '完成学生认证的会员，周五至周日指定茶饮系列享第二杯半价。免费开通，认证入口在我的-会员信息。',
    perks: ['周末双日生效', '指定系列适用', '可与等级权益同享'],
    tone: 'ink',
    layout: 'STUDENT',
  },
]

export const benefitMetaOf = (code?: string) =>
  BENEFIT_META.find((meta) => meta.code === code) ||
  ({
    code,
    name: '会员福利',
    tagline: 'Orander GO 会员专享',
    description: '该福利详情即将上线，敬请期待。',
    perks: [],
    tone: 'green',
    layout: 'GENERIC',
  } as BenefitMeta)
