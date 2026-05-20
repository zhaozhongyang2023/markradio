# 🎵 MoodWave V6 — AI DJ 电台

> **不是播放器。是懂你在 Steam Deck 上此刻心情的 AI DJ。**

| 🎮 打 Boss → AI 配燃曲 | 🌙 深夜躺床 → 深夜 FM 氛围 | 🌧️ 外面下雨 → 自动放慢歌 |
|:--:|:--:|:--:|

---

## 它是什么

说出你现在的状态——

剩下的全部由 AI 自动完成：**DJ 开场白、歌单、推荐理由、语音朗读、自动播放。**

MoodWave 不是音乐播放器，不是 AI 助手。

它像 **Spotify AI DJ + 深夜 FM + 游戏陪伴**——有情绪感、有陪伴感、有时间感、有深夜 FM 氛围。

| ✅ 这样说 | ❌ 不这样说 |
|---------|---------|
| 今晚适合安静一点 | 根据您的当前情绪推荐以下歌曲 |
| 忘了歌名，也能找到歌 | 智能歌单算法 |
| 它好像知道你现在想听什么 | AI 情绪分析 |
| 今晚适合慢一点 | 根据用户偏好推荐 |
| 适合边刷素材边放空 | AI 已分析当前用户状态 |
| 外面下雨的时候，总该听点慢的 | 根据算法生成歌单 |

---

## 为什么你需要它

| 😩 Steam Deck 玩家的痛点 | ✨ MoodWave 怎么解决 |
|:--|:--|
| 切歌要退出游戏，打断沉浸感 | **Decky 插件游戏内操控**，按 `...` 就能切歌换氛围 |
| 不知道听什么，翻歌单 10 分钟 | **AI 一句话生成歌单**，心情、天气、日期自动感知 |
| 一个人打游戏有点孤单 | **DJ 语音陪伴**，像深夜 FM 有温度的解说 |

---

## 核心体验

### 📻 AI 电台 — 按心情开电台

选一个心情（开心 / 平静 / 忧郁 / 悲伤 / 治愈 / 愤怒），AI DJ 自动生成：

- 🎙️ **DJ 开场白** — 像深夜电台一样有温度
- 🎵 **精编歌单** — 每首歌附带 AI 写的推荐理由
- 🔊 **语音朗读** — DJ 帮你把开场白念出来
- ▶️ **自动播放** — 点一下，剩下的全自动

### 🎮 Game Radio — 游戏氛围电台

**不用切出游戏**，Decky 插件里一键开启。

| 氛围 | AI DJ 会这样说 | 适合 |
|:--|:--|:--|
| 🗡️ Boss 战 | "今晚燃一点，法印按到底" | 老头环、只狼、巫师3 战斗 |
| 🗺️ 探索地图 | "慢慢走，不急着赶路" | 巫师3 威伦骑马、塞尔达旷野 |
| 🏎️ 赛车竞速 | "今晚速度别停" | 马车8、Forza |
| 🌾 种田放松 | "今晚别太累了" | 星露谷、牧场物语 |
| 📺 模拟器怀旧 | "像小时候一样" | GBA、PSP 模拟器 |

> V6 特性：三个模块歌单**完全独立**，切换模块自动记忆播放位置，切回即恢复。

### 🔍 AI 寻歌 — 自然语言找歌

告诉 AI 你想听什么，它帮你找。

```
"想听适合下雨天放空的英文老歌"
"有没有像巫师3原声那种中古民谣"
"来点 90 年代港乐"
```

---

## 平台支持

| 平台 | 模式 | 说明 |
|------|------|------|
| 🎮 Steam Deck | 桌面 PWA + 游戏模式 Decky 插件 | 主力平台，两种模式无缝切换 |
| 🖥️ 树莓派 | 局域网电台 | 部署在 Pi 上，全家人共用 |
| 💻 MacBook | 开发调试 | 本地 dev server |

---

## 技术亮点

| 亮点 | 说明 |
|------|------|
| 🧠 **四层 AI Prompt 架构** | 角色设定 / 上下文注入 / 用户状态感知 / 输出规则约束——每一层让 DJ 更像真人 |
| 🌤️ **天气感知推荐** | 接 OpenWeather，外面下雨自动推慢歌 |
| 📅 **特殊日期感知** | 自动识别 24 节气、春节、生日，当天选曲有纪念感 |
| 🧬 **Music DNA** | AI 分析网易云听歌记录，推导你的音乐人格，越用越懂你 |
| 🔊 **Fish Audio TTS** | DJ 开场白语音朗读，支持本地引擎兜底 |
| 🔗 **网易云深度集成** | 扫码登录，读取歌单、红心、日推、私人 FM |
| 📡 **DLNA/UPnP 投播** | Steaming 到客厅音箱 / 树莓派 DAC |
| 🛡️ **熔断器保护** | 所有外部 API 有自动降级，单点故障不影响使用 |
| ⚡ **WebSocket 实时推送** | 播放状态毫秒级同步到 Decky 插件和 Web UI |

### 四层 AI Prompt 架构（核心壁垒）

```
┌──────────────────────────┐
│ ① 角色层：你是谁           │  → 深夜 FM DJ，不是客服，不是算法
├──────────────────────────┤
│ ② 上下文层：当前状态        │  → 心情、天气、日期、时间段、播放历史
├──────────────────────────┤
│ ③ 用户状态层：偏好与意图    │  → 音乐 DNA、网易云红心、自然语言意图
├──────────────────────────┤
│ ④ 输出规则层：怎么说        │  → 凝练、有留白、禁止客服腔、禁止提"算法"
└──────────────────────────┘
```

---

## 快速开始

### Steam Deck 一键安装

```bash
git clone --depth 1 https://github.com/zhaozhongyang2023/markradio.git ~/moodwave
cd ~/moodwave
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

详细教程 → [INSTALL.md](./INSTALL.md)（零基础可操作，全程复制粘贴）

### 配置

支持 `.env`（树莓派/开发）或 `~/.config/moodwave/config.env`（Steam Deck）。

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_PROVIDER` | ✅ | deepseek / openai / qwen / gemini / custom |
| `AI_API_KEY` | ✅ | AI 平台 API Key（DeepSeek 免费注册） |
| `AI_BASE_URL` | - | 自定义 API 地址 |
| `AI_MODEL` | - | 模型名（自动匹配平台） |
| `FISH_AUDIO_API_KEY` | - | Fish Audio 语音朗读 |
| `NETEASE_API_BASE` | - | 网易云 API 地址 |
| `OPENWEATHER_API_KEY` | - | 天气 API（不填默认晴天） |
| `MUSIC_DIR` | - | 本地音乐目录 |

### 树莓派部署

```bash
git clone https://github.com/zhaozhongyang2023/markradio.git ~/moodwave
cd ~/moodwave
npm install
cp .env.example .env   # 编辑填入 AI Key 等配置
npm run build
npm start
```

管理命令：

```bash
bash scripts/moodwave.sh start    # 启动全部服务（含 Firefox 全屏）
bash scripts/moodwave.sh stop     # 停止全部服务
bash scripts/moodwave.sh refresh  # 刷新（清理缓存 + 重启）
bash scripts/moodwave.sh status   # 查看服务状态
bash scripts/moodwave.sh server   # 仅启动后端（无浏览器）
```

### 本地开发

```bash
npm install && cp .env.example .env
npm run dev:api    # 终端 1
npm run dev:web    # 终端 2 → http://localhost:8080
```

---

## API

兼容 V3/V4/V5 旧接口，V6 新增：

```
GET  /api/health           # 健康检查
GET  /api/status           # 完整状态
POST /api/ai/radio         # AI 电台（按心情）
POST /api/ai/search        # AI 寻歌（自然语言）
POST /api/ai/next-radio    # 换个氛围
POST /api/ai/game-radio    # 游戏电台（Game Radio）
POST /api/play             # 播放
POST /api/pause            # 暂停
POST /api/next             # 下一首
POST /api/prev             # 上一首
POST /api/switch-mode      # 切换电台/寻歌/游戏模块
GET  /ws/stream            # WebSocket 实时推送
```

---

## 安全

- 所有 API Key 只存本机，权限 `600`
- 前端和 Decky 插件不含第三方密钥
- 安装脚本不打印用户输入的 Key
- `.env`、`data/`、`dist/` 不进入版本控制

---

## 发布

```bash
node scripts/package-steamdeck.mjs   # → release/
npm test                              # 49 tests
```

---

> 🛒 不想自己折腾？闲鱼搜 **MoodWave** 获取一键安装 + 终身技术支持。
