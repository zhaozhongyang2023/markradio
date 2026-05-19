# 🎵 MoodWave V5 — AI DJ 电台

> 不是播放器，不是 AI 助手。
> 是一个**懂你当前状态的 AI DJ 电台**。

---

## 它是什么

用户不需要找歌、建歌单、管理音乐。只需要**表达现在的状态**，剩下全部由 AI 自动完成——DJ 开场白、歌单、推荐理由、语音朗读、自动播放。

MoodWave 应该像 **Spotify AI DJ + 深夜 FM + 游戏陪伴**。

AI 不是工具，是**会陪伴你的电台 DJ**——有情绪感、有陪伴感、有时间感、有深夜 FM 氛围。

---

## 正确 vs 错误

| ✅ 对的 | ❌ 错的 |
|---------|---------|
| 今晚适合安静一点 | 根据您的当前情绪推荐以下歌曲 |
| 忘了歌名，也能找到歌 | 智能歌单算法 |
| 它好像知道你现在想听什么 | AI 情绪分析 |
| 今晚适合慢一点 | 根据用户偏好推荐 |
| 适合边刷素材边放空 | AI 已分析当前用户状态 |
| 外面下雨的时候，总该听点慢的 | 根据算法生成歌单 |

---

## 平台

| 平台 | 模式 | 说明 |
|------|------|------|
| 🖥️ 树莓派 | 局域网电台 | 部署在 Pi 上，手机/PWA 浏览器访问，全家人共用 |
| 🎮 Steam Deck | 桌面 PWA + 游戏模式插件 | 桌面模式浏览器，游戏模式 Decky 面板 |
| 💻 MacBook | 开发调试 | 本地 dev server |

---

## Steam Deck 游戏模式

在游戏模式中，MoodWave 是 **AI 游戏电台**。

打开 Decky 插件 → 🎮 Game Radio → 选氛围 → AI DJ 自动配 BGM：

- 🗡️ Boss战 — 燃一点
- 🗺️ 探索地图 — 适合慢慢跑图
- 🏎️ 赛车竞速 — 今晚速度别停
- 🌾 种田放松 — 今晚别太累了
- 📺 模拟器怀旧 — 像小时候一样

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + Vite 7 | PWA 高保真播放器，树莓派/Steam Deck 双端 UI |
| 后端 | Node.js + Fastify 5 | 树莓派本地中枢，WebSocket 实时推送 |
| AI | DeepSeek / OpenAI / Qwen / Gemini | OpenAI-compatible API，自动生成 DJ 文案和歌单 |
| 音乐 | 网易云 API / Demo 歌单 | 真实音乐库或内置 Demo 体验 |
| 语音 | Fish Audio | AI 朗读 DJ 开场白 |
| 天气 | OpenWeather | 自动根据天气调整推荐氛围 |
| 数据 | SQLite | 播放记录、偏好、TTS 缓存 |

---

## 快速开始

### Steam Deck 一键安装

```bash
git clone --depth 1 -b codex/moodwave-v5 https://github.com/zhaozhongyang2023/markradio.git ~/moodwave
cd ~/moodwave
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

详细指南 → [INSTALL.md](./INSTALL.md)

### 树莓派部署

```bash
git clone https://github.com/zhaozhongyang2023/markradio.git ~/markradio
cd ~/markradio
npm install
cp .env.example .env   # 编辑填入 AI Key 等配置
npm run build
npm start
```

### 本地开发

```bash
npm install && cp .env.example .env
npm run dev:api    # 终端 1
npm run dev:web    # 终端 2 → http://localhost:8080
```

---

## 配置

支持 `.env`（树莓派/开发）或 `~/.config/moodwave/config.env`（Steam Deck）。

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_PROVIDER` | ✅ | deepseek / openai / qwen / gemini / custom |
| `AI_API_KEY` | ✅ | AI 平台 API Key |
| `AI_BASE_URL` | - | 自定义 API 地址 |
| `AI_MODEL` | - | 模型名（自动匹配平台） |
| `FISH_AUDIO_API_KEY` | - | Fish Audio 语音朗读 |
| `NETEASE_API_BASE` | - | 网易云 API 地址 |
| `OPENWEATHER_API_KEY` | - | 天气 API（不填默认晴天） |
| `MUSIC_DIR` | - | 本地音乐目录 |

---

## API

兼容 V3/V4 旧接口，新增 V5 Steam Deck 语义接口：

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
npm test                              # 29 tests
```
