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

## 2026-05-24（下午）

### Music DNA 四合一（P1~P4）

**P1 — 中文分词精确匹配**
- `Intl.Segmenter` 分词替代 `String.includes`，关键词匹配更精准
- "想听City Pop" 不再误匹配到 "City Pop 2024年鉴"

**P2 — 置信度自动提级**
- 行为信号 ≥30 → confidence 自动升 "high"
- 行为信号 ≥15 → confidence 自动升 "medium"
- 无需手动操作，数据够了就升级

**P3 — 模糊搜索扩展**
- 新增 "有没有XX的歌" "放点XX那种感觉的" "整点XX" 等模糊查歌
- `fuzzyPattern` 正则覆盖更多口语化表达

**P4 — DNA 历史时间轴**
- 每次重新生成 DNA 时自动归档旧版（最多 10 条）
- 前端折叠面板展示 DNA 变更历史
- Diff 高亮标注维度变化

### 修复
- `segmentWords` 函数体移到顶层，修复 P1 闭包性能问题
- 正则 `\s` 恢复

---

## 2026-05-24（凌晨）

### Music DNA
- `buildDnaBlock` 旧字段 → V2 新字段同步
- `saveQuery` 重构，替换内联 localStorage 写入

### Deck 插件
- 插件状态丢失修复：gameVibe / query 持久化到 localStorage
- useEffect → 同步 localStorage 写入，防状态重置

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

---

## 2026-05-26 ~ 2026-05-29

### Game Whisper（游戏低语系统）
- **`fallbackGameVibeSentence`** — 10+ 款游戏名模糊匹配 + mood 兜底（愤怒/开心/悲伤/平静/忧郁/治愈），AI 漏填时自动补 6~12 字陪伴句
- **5 款游戏专属预设包** — 巫师3、刺客信条·影、赛博朋克2077、塞尔达旷野之息、生化危机4，每包含 start/next_radio/track_change/rain/night 等场景专属短句
- **游戏名匹配增强** — 全角/半角冒号、中英文名、大小写兼容（如"刺客信条：影""Assassin's Creed Shadows"）
- **兜底策略** — 命中内置预设 → 命中 fallback 10+ 热门游戏 → mood 通用兜底，三级降级不打断体验

### 网易云喜欢收藏
- Decky 插件播放面板新增 ♥ 按钮，一键收藏/取消收藏到网易云红心歌单
- 自动检测当前歌曲是否已收藏，状态实时同步
- 仅在网易云来源歌曲可用（本地/Demo 歌曲自动隐藏）

### 黑胶唱片视觉效果
- Decky 插件内黑胶转盘：播放时唱臂落针旋转，暂停时回位，速度渐变
- 唱片封面自动匹配当前歌曲，无封面时显示默认黑胶纹理
- 极简模式拥有独立 CSS 变量体系（唱片内缩/标签大小/唱臂尺寸/角度参数）

### 天气标签 & Decky UI
- 天气标签从独立区域合并到 brand bar 右侧，布局更精致
- 重连按钮视觉优化，游戏标题区域调整

### 修复
- 极简模式顶部间隙缩小（padding 6→2px）
- 暂停时唱头完全离开唱片外沿（rest 角度 22→28deg）
- `normalizeName` 正则补全角冒号，修复"刺客信条：影"匹配失败
- `gameVibeSentence` 映射补全 — 焦虑→忧郁
- 进度条百分比浮点精度问题（`Math.round` 取整）
- deck-companion 三处微创修复（状态丢失、过度跳帧、排版溢出）
- 兼容 `plan today` 游戏模式参数

### 测试
- 补齐 game-understanding/profile/voice/music 单元测试（113→118）
- `fallbackGameVibeSentence` 5 用例：游戏命中 / mood 兜底 / 未知 fallback

### 文档
- 补充游戏低语说明到 AGENTS.md
- 补充 Deck 伴侣开发规范：CSS 变量体系 / 微调原则 / 验证流水线
