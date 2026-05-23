# Changelog

## 2026-05-24

### Music DNA v2
- 维度从 3 升级为 5：新增 `game_vibes`（游戏氛围映射）和 `confidence`（置信度）
- DNA 叠加分析感知优化，前端显示上次分析摘要
- Prompt 全面替换，强化指令防推倒重来

### Steam Deck 界面
- V3/V4 宽度统一 560px 居中约束
- Deck 检测改用 JS `is-deck` class，替代 `@media` 查询
- V3 布局优化：缩减 hero-panel 高度，扩张频谱和卡片区域
- CSS 选择器修复：`.is-deck .v4-shell` → `.v4-shell.is-deck`

### 修复
- 服务端静态文件 `Cache-Control: no-cache`，防止手机缓存旧版
- 网易云扫码登录超时修复（QR check 延长至 30s），前端轮询加防重叠保护
- V3/V4 播放速度优化 + 控制修复
- CSS 语法错误修复：`@media (max-height: 800px)` 缺 `{`

---

## 2026-05-22

### GitHub 首页改版
- 5 张配图（独立游戏 Steam 商店页风格）
- Hero 文案："我的世界，你一直在。"
- 产品定义更新，技术亮点折叠去表化
- API / 发布区块折叠

### 版本管理
- 版本号统一为 `5.0.0`，语义版本
- 删除全部旧标签，打 `v5.0.0`
- 打包脚本动态读取版本号

### 其他
- 赞助方式从 GitHub Sponsors 改为微信收款码
- marketing/ 移除公开仓库
