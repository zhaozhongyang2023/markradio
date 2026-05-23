# Changelog

## 2026-05-24（深夜）

### Music DNA 加权搜索
- 新增 `applyDnaWeight()` — 根据用户 Music DNA 的 `music_taste` 关键词给候选歌曲打分
- 新增 `sortByDnaWeight()` — 符合口味的歌自动排到歌单前面
- `confidence` 作为权重倍率：high=1.5x / medium=1.0x / low=0.5x
- DNA 现在不仅分析，还直接影响选歌结果

---

## 2026-05-24（晚间）

### DNA 面板
- 修复 DNA 面板黑屏：显式设置卡片背景色和宽度
- DNA 面板标题加版本号 v4，用于验证部署

### 修复
- 补回 Deck V3/V4 is-deck CSS 布局规则
- 回滚缓存控制改动（onSend hook 导致页面错误）

---

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
