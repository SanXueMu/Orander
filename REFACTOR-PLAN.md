# Orander 小程序全面重构计划

> 仓库: https://github.com/SanXueMu/Orander.git
> 本地: /Users/passions/WeChatProjects/Orander
> 总计: 12 个阶段（阶段 0-11），52 项改进（含 1 个关键 Bug 修复）

---

## 关键 Bug：管理员上传菜品后其他用户无法看到

**根因**: `miniprogram/utils/cloud.ts` 中 `CLOUD_SYNC_ENABLED = false` 被写死为 false。
- `initCloud()` 永远返回 false → 所有云函数调用被跳过
- 管理员上传菜品只存本地 storage，其他用户看到的永远是各自的本地数据
- 修复：改为 `true`，并在 `app.onLaunch` 中尽早初始化云开发环境

---

## 阶段总览

| 阶段 | 类型 | 核心内容 | 改动文件数 |
|------|------|----------|-----------|
| 0 | 基础设施 | 仓库初始化 + PAT 推送基线 | 3 |
| 1 | **致命 Bug** | `CLOUD_SYNC_ENABLED` → `true` | 2 |
| 2 | 安全 | 云端密码鉴权 + token 校验 | 4 |
| 3 | 后端重构 | God Function 拆分 + 分页 + 5 个新 action | 1 |
| 4 | 前端核心 | 内存缓存 + 废弃 API 替换 + 分类记忆 | 3 |
| 5 | 功能补全 | 注册 orders/settings + TabBar 3 Tab | 5 |
| 6 | 功能补全 | 下单备注 + 菜品搜索 + 售罄清理 | 5 |
| 7 | 管理增强 | 订单总览 + 统计 + 营业状态 | 3 |
| 8 | 主题集成 | Behavior 统一注入 + buildPageLook 接线 | 10+ |
| 9 | 交互修复 | 防重提交/密码锁定/状态条等 10 项 | 5 |
| 10 | UI 打磨 | 图标/动画/骨架屏/对比度/focus 态 | 8+ |
| 11 | 架构 | 类型安全 + 组件提取 + 事件总线 | 6+ |

---

## 第 0 阶段: 仓库初始化

- 使用 GitHub PAT 认证推送到远程仓库
- 配置 `.gitignore`
- 提交原始代码作为基线（commit 0）
- 确保本地仓库与远程 `main` 分支同步

---

## 第 1 阶段: 修复关键 Bug — 云端菜品同步

**改动范围**:
- `miniprogram/utils/cloud.ts` — `CLOUD_SYNC_ENABLED` 改为 `true`
- `miniprogram/app.ts` — `onLaunch` 中调用 `initCloud()`

---

## 第 2 阶段: 云函数安全加固

**鉴权方案**: 云端密码校验（两人共用一个密码）
- 密码存储在云端 `config` 集合中（hash），首次自动初始化为默认密码 `orander2026`
- 前端登录传密码给云函数 `verifyAdmin`，比对后返回 adminToken
- 所有管理操作需附带 adminToken，云函数侧校验
- 管理端可修改密码

**改动范围**:
- `cloudfunctions/orander/index.js` — `verifyAdmin`/`changeAdminPassword` + 管理操作加 token 校验
- `cloudfunctions/orander/package.json` — `wx-server-sdk` 锁定 `2.6.3`
- `miniprogram/utils/orander.ts` — `verifyAdminPassword` 改为调用云函数
- `miniprogram/utils/cloud.ts` — 新增 `verifyAdminCloud`/`changeAdminPasswordCloud`

---

## 第 3 阶段: 云函数架构重构 + 新功能

| # | 问题 | 修复 |
|---|------|------|
| 3 | 258 行 God Function | action 注册表模式重构 |
| 4 | 无分页 | `parsePagination` 支持 page/pageSize |
| 5 | 订单号并发碰撞 | `generateId` 加随机后缀 |
| 6 | syncVisitor 竞态 | openId 保障 |
| 8 | updateOrderStatus 多余读取 | 直接 update |
| 9 | 缺少日志 | 全链路 `log()` |
| F5 | 无全局订单 | 新增 `listAllOrders` |
| F9 | 无营业状态 | 新增 `getBusinessStatus`/`setBusinessStatus` |
| F10 | 无统计 | 新增 `getOrderStats`（营收/热销榜）|

**改动范围**: `cloudfunctions/orander/index.js` — 完全重写

---

## 第 4 阶段: 前端核心层重构

| # | 问题 | 修复 |
|---|------|------|
| 2 | orander.ts 970 行 | 区块注释清晰分区 |
| 6 | getDishes 频繁全量读 storage | `_dishCache` 内存缓存 + dirty flag |
| 5 | onShow 全量刷新 | `saveLastCategory`/`getLastCategory` |
| 9 | 废弃 wx.getSystemInfo | `wx.getWindowInfo` + `wx.getAppBaseInfo` |

**改动范围**:
- `miniprogram/utils/orander.ts` — 内存缓存、分类记忆、类型增强
- `miniprogram/utils/cloud.ts` — 新增所有新云函数前端封装
- `miniprogram/components/navigation-bar/navigation-bar.ts` — 废弃 API 替换

---

## 第 5 阶段: 注册遗漏页面 + 访客订单历史

**改动范围**:
- `miniprogram/app.json` — 注册 orders/order-detail/settings
- `miniprogram/components/visitor-tab-bar/` — 2 Tab → 3 Tab（菜单/订单/我的）
- `miniprogram/pages/orders/index.ts` — 修复路由 + session 校验 + theme 接线
- `miniprogram/pages/profile/index.wxml` — 新增"通用设置"入口

---

## 第 6 阶段: 下单备注 + 菜品搜索 + 售罄清理

**改动范围**:
- `miniprogram/pages/cart/` — 备注输入框
- `miniprogram/pages/dish/` — 搜索栏 + `cleanSoldOutFromCart`

---

## 第 7 阶段: 管理员订单总览 + 营业状态 + 数据统计

**改动范围**:
- `miniprogram/pages/admin/index.*` — 2 Tab → 4 Tab（菜单/订单/统计/用户）

---

## 第 8 阶段: 主题字体系统集成

**改动范围**:
- `miniprogram/behaviors/page-look.ts` — 新建 Behavior
- 所有页面 `.ts` — 引入 Behavior，消除 `themeClass` 硬编码

---

## 第 9 阶段: 用户交互漏洞修复（10 项）

- 购物车防重提交锁
- 购物车删除确认对话框
- 数量步进上限 99
- navigateBack 替代 redirectTo
- 分类选择记忆
- 管理员密码错误锁定（5 次锁 60 秒）
- 收据页动态状态条
- Profile 局部刷新
- 滑动删除适配

---

## 第 10 阶段: 页面设计打磨（10 项）

- TabBar SVG 图标
- 登录页品牌优化
- 收据页呼吸动画
- ink 主题对比度提亮
- 价格格式统一
- 空状态 SVG 插画
- 表单 focus 态边框
- 骨架屏占位
- 菜单卡片高度对齐

---

## 第 11 阶段: 类型安全 + 组件提取

- 消除 `Record<string, unknown>`，定义 ViewModel 类型
- 提取 `dish-stepper` 公共组件
- 新建事件总线 EventBus
- 请求层统一错误处理

---

## 提交历史预览

```
* feat(types): 类型安全 + 组件提取 + 事件总线              [阶段11]
* style(ui): 页面设计打磨 — 图标/动画/对比度/骨架屏          [阶段10]
* fix(ux): 10 项用户交互漏洞修复                            [阶段9]
* feat(theme): 主题/字体系统集成 — buildPageLook 全页面接线   [阶段8]
* feat(admin): 管理员订单总览 + 营业状态 + 经营数据统计       [阶段7]
* feat(visitor): 下单备注 + 菜品搜索 + 售罄菜品自动清理      [阶段6]
* feat(navigation): 注册遗漏页面 + 访客订单历史入口          [阶段5]
* refactor(core): 前端数据层重构 — 内存缓存/类型完善/废弃API [阶段4]
* refactor(cloud): 云函数领域拆分 + 分页 + 新能力            [阶段3]
* fix(security): 云函数管理员鉴权 + 密码安全加固             [阶段2]
* fix: 修复管理员上传菜品后其他用户无法看到的致命问题         [阶段1]
* init: Orander 微信点餐小程序初始版本                       [阶段0]
```

---

## 执行策略

- 每个阶段单独 commit + push
- 使用 PAT 配置远程认证
- 每个阶段完成后确认，再进入下一阶段
