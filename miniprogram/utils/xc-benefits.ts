/* 会员福利前端文案库（与云端 benefits 集合 code 对齐） */

export interface BenefitMeta {
  code: string
  name: string
  tagline: string
  description: string
  perks: string[]
  tone: 'gold' | 'green' | 'warm' | 'ink'
}

export const BENEFIT_META: BenefitMeta[] = [
  {
    code: 'GOLD_CARD',
    name: '金喜卡',
    tagline: '一张卡，杯杯 8.8 折',
    description:
      '金喜卡是 Orander GO 的付费会员卡。开卡后全单 88 折自动生效，与会员等级折扣可叠加叠加期以活动页说明为准。卡面金色寓意「喜上眉梢」，权益全年有效。',
    perks: ['全单 8.8 折', '专属金卡客服通道', '生日赠饮券 1 张'],
    tone: 'gold',
  },
  {
    code: 'MONDAY_FREE_FEE',
    name: '周一免配送费',
    tagline: '每周一，配送费我们请',
    description:
      'V1 茶友及以上会员，每周一下单（喜外送）自动免配送费，无需领券。成长值达到 100 自动升级 V1，升级后次周一生效。',
    perks: ['每周一生效', '喜外送订单适用', '自动享受无需领取'],
    tone: 'green',
  },
  {
    code: 'NEWBIE_20',
    name: '新人礼 · 满 20 减 5',
    tagline: '第一杯，我们买单 5 块',
    description: '新注册会员可领「满 20 减 5」新人券一张，下单时自动匹配可用券抵扣，有效期 30 天。',
    perks: ['满 ¥20 可用', '注册后 30 天有效', '下单自动抵扣'],
    tone: 'warm',
  },
  {
    code: 'STUDENT_CARD',
    name: '学子卡',
    tagline: '学生认证，指定饮品第二杯半价',
    description: '完成学生认证的会员，周五至周日指定茶饮系列享第二杯半价。认证入口在我的-会员信息。',
    perks: ['周末双日生效', '指定系列适用', '可与等级权益同享'],
    tone: 'ink',
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
  } as BenefitMeta)
