# MoodWave 项目约定

## 改动原则
- 改动要小，方便审查
- 动手前先说文件和计划
- 不胡编路径和配置
- 不要泄露密钥和敏感信息
- 行为变化尽量补测试
- 默认中文，表达简洁，可复制

---

## 项目架构

```
MoodWave — AI DJ 电台，3 层架构

server/          Fastify 后端 (API + ffplay 播放 + DB)
src/             React/Vite 前端 (Web 控制台)
deck-companion/  Decky 插件 (Steam Deck 游戏模式)
switch-companion/ Switch 浏览器伴侣 (NRO 启动器 + HTML)
```

### 三层关系
| 层 | 技术栈 | 职责 |
|----|--------|------|
| `server/` | Fastify + SQLite + ffplay | API、服务端播放、状态持久化 |
| `src/` | React + Vite | Web 控制台，自己管理 `<audio>` 元素 |
| `deck-companion/` | Decky SDK + React | Steam Deck 游戏模式插件，调用 API |
| `switch-companion/` | 纯 HTML/JS | Switch 浏览器页面，XHR 调用 API |

---

## Server (`server/`)

### 文件职责

| 文件 | 职责 |
|------|------|
| `index.js` | 入口：Fastify 实例、路由、WebSocket、**两条播放路径** |
| `config.js` | 环境变量解析（兼容旧 `MARKRADIO_*`） |
| `state.js` | SQLite 持久化，键值存储 + 播放记录 + TTS 缓存 |
| `player.js` | ffplay 服务端播放器（仅 Deck/Switch 插件使用） |
| `scheduler.js` | AI 电台计划生成（调用 OpenAI + 网易云） |
| `music.js` | 歌曲搜索、匹配、合并逻辑 |
| `context.js` | DJ 上下文构建（prompt 拼装） |
| `openai.js` | AI 调用封装（兼容 OpenAI / DeepSeek） |
| `voice.js` | TTS 语音合成（Fish Audio / 本地 F5-TTS） |
| `profile.js` | Music DNA 分析（三维度：core_moods / listening_habits / music_taste） |
| `cast.js` | UPnP/DLNA 投屏 |
| `cast-url.js` | 投屏 URL 构造 |
| `circuit-breaker.js` | 熔断器（外部服务保护） |
| `mood.js` | 心情推荐与标准化 |
| `weather.js` | OpenWeather 集成 |
| `special-dates.js` | 节日/生日/节气检测 |
| `game-understanding.js` | 游戏场景理解 |
| `netease-auth.js` | 网易云扫码登录 |
| `providers/netease.js` | 网易云 API 调用 |
| `defaults.js` | Demo 歌单和默认值 |

### ⚠️ 关键架构：两条播放路径

服务端有 **两条独立的播放动作函数**，不可混用：

**`applyPluginAction`**（Deck/Switch 插件用）
- 路由：`POST /api/play` `/pause` `/next` `/prev`
- 控制 ffplay 服务端播放器（`playerStop()` + `playSequence()`）
- 必须设置 `songActive` 字段（DJ 朗读时 false，歌曲时 true）
- prev/next 返回 `{ok: false, reason: 'first'|'last'}`

**`applyPlaybackAction`**（Web 前端用）
- 路由：`POST /api/playback/:action`
- 只更新 `now` 状态，**不操作 ffplay**
- Web 前端自行管理 `<audio>` 元素播放

### 状态管理

- `store` = `StateStore` 实例（SQLite）
- `now` = 当前播放状态（track, playing, progress, songActive, startedAt, introPlayed）
- `plan-{mode}` = 当前电台计划（queue, tts, cardTts, mood）
- `publicNow()` 计算 `progressRatio`：**必须检查 `songActive`**

### 状态字段约定

| 字段 | 类型 | 说明 |
|------|------|------|
| `now.playing` | bool | 是否播放中 |
| `now.songActive` | bool | **实际歌曲播放中**（非 DJ 朗读）|
| `now.startedAt` | number | 歌曲开始时间戳（onTrackStart 设置） |
| `now.introPlayed` | bool | DJ 导读是否已播放 |
| `now.progress` | number | 0-1 进度（暂停时保留） |
| `now.track` | object | 当前曲目 {id, title, artist, url, duration, lyric} |
| `plan.queue` | array | 待播曲目列表 |
| `plan.tts` | object | DJ 开场 TTS {url, text} |
| `plan.cardTts` | array | 每首歌的导读 TTS |

### 路由规范

- Fastify 路由在 `index.js` 顶部区域
- API 前缀统一 `/api/`
- WebSocket `/ws/stream`
- 静态文件 `/tts/:hash.mp3` `/cast/:id.mp3`

---

## 前端 (`src/`)

### 文件职责

| 文件 | 职责 |
|------|------|
| `App.jsx` | 主应用（~3500 行）：状态管理、播放控制、UI 渲染 |
| `api.js` | API 调用封装（fetch + 自动检测 API Base） |
| `styles.css` | 全局样式（~3500 行） |
| `main.jsx` | React 入口 |

### 视图模式

| 模式 | 触发 | 特点 |
|------|------|------|
| `v3` | 默认（树莓派/浏览器） | 传统电台 UI，完整控制面板 |
| `v4` | Deck 检测 / 手动切换 | 极简列表 UI，`V4RadioView` 组件 |

### ⚠️ 关键架构：前端自己管理播放

**前端不依赖服务端 ffplay**。所有 Web 播放通过 `<audio>` 元素：
- `playback()` → `startPlayback()` → `runPreIntro()` → `runCardIntro()` → `playLocalMusic()`
- TTS 朗读用 Web Audio API（AudioContext + AudioBuffer）
- 进度条用 `audio.currentTime` / `audio.duration`

### 状态管理

- 核心状态：`track`, `isPlaying`, `reading`, `plan`, `queue`, `progress`
- 播放流程保护：`playbackRunRef` (runId) 防竞态
- 自动播放：`autoplayToken` + `autoplayOptionsRef` 驱动
- WebSocket 状态同步：`setState()` 批量更新

### ⚠️ TTS 等待策略

- `waitForIntroTtsUrl` / `waitForCardTtsUrl` 轮询服务端 TTS 就绪
- **超时必须 ≤ 8s**，超时跳过导读直接播歌
- TTS 是锦上添花，不能阻塞音乐播放

### 样式规范

- 全局 CSS（非 CSS Modules），类名语义化
- 暗色主题为主：`background: #050606; color: #f6f3ec`
- 卡片弹窗（DNA/投屏/扫码）用 `.qr-backdrop` + `.qr-card`
- 移动端适配用 `max-width` + `viewport` 单位

---

## 伴侣插件

### Deck 伴侣 (`deck-companion/`)

- Decky 插件框架：`definePlugin()` + React
- 状态同步：轮询 `/api/now` 每 5s + `visibilitychange`
- `apiRequest` 必须加 `AbortController` + 15s 超时
- 进度条检查 `songActive`：`if (playing && songActive)`
- 构建：`npm run build`（Rollup），产物 `dist/`
- 插件权限：`root:root`，目录 `/home/deck/homebrew/plugins/moodwave-deck-companion/`

### Switch 伴侣 (`switch-companion/`)

- 纯 HTML/CSS/JS，无构建
- XHR 调用 API（`apiRequest` 必须 `xhr.timeout = 15000`）
- 路由：`/switch`（由 Fastify 直接 serve）
- Switch 本地 IP 硬编码在 `launcher/main.c`（编译宏）

---

## 部署 (`deploy.sh`)

### 服务器配置

| 设备 | IP | 用户 | 端口 | 模式 |
|------|-----|------|------|------|
| 树莓派 | `192.168.2.33` | `pi` | API 8765 / Web 80 | `standard` |
| Steam Deck | `192.168.3.121` | `deck` | API 38765 / Web 38080 | `steamdeck` |

### 部署流程

```bash
./deploy.sh          # 两台全发
./deploy.sh pi       # 仅树莓派
./deploy.sh deck     # 仅 Steam Deck
```

1. 构建前端（`npm run build`）
2. 构建 Decky 插件（`npm run build` in deck-companion）
3. SSH 停止远端服务
4. rsync 同步 `dist/` `server/` `scripts/` + deck 插件文件
5. 远端 `moodwave.sh refresh`
6. Deck: `systemctl restart plugin_loader` + Steam 重启

### ⚠️ 关键

- **禁止提交 `.env`**（含 API 密钥）
- 服务端用 `moodwave.sh` 管理（start/stop/refresh/status/server）
- `data/markradio.db` 是 SQLite 数据文件，**不是** `moodwave.db`
- Deck 插件必须 `sudo cp` + `chmod a+rX`

### `moodwave.sh` 服务管理

- `start` — 启动（含缓存清理）
- `stop` — 停止
- `refresh` — 重启（stop + clear_cache + start）
- `server` — 纯服务端模式（无 Firefox kiosk）
- `status` — 状态检查

---

## Git 分支

### 当前结构
```
main          ← 唯一主干
moodwave/v6   ← v6 功能分支
```

### 命名规范
- 前缀统一：`moodwave/<功能名>`
- 合入 main 后及时删除远程分支
- 每次修改必须同步到 `main` + `moodwave/v6`

### Commit 规范
- 中文描述，格式：`fix:` / `feat:` / `refactor:` + 简短说明
- 一提交一主题，方便 revert

---

## 测试

- Node.js 原生 test runner：`node --test tests/*.test.js`
- 单元测试在 `tests/unit/`，集成测试在 `tests/integration/`
- **行为变化必须补测试**（纯 CSS/样式改动除外）
- 运行：`npm test`

---

## 常见反模式（❌ 禁止）

| 反模式 | 正确做法 |
|--------|----------|
| TTS 等待 > 8s | ≤ 8s，超时跳过导读播歌 |
| `applyPluginAction` 忘设 `songActive` | 所有 `onTrackStart` 设 `true`，切歌设 `false` |
| `applyPlaybackAction` 操作 ffplay | 只更新 `now` 状态 |
| `publicNow()` 不检查 `songActive` | `progressRatio = (playing && songActive) ? ... : 0` |
| `advanceEndedTrack` 双重播放 | 只用 `autoplayToken` 触发，不要额外调 `api.playback('next')` |
| prev 第一首原地重播 | `ni = ci > 0 ? ci-1 : -1`（-1 表示不可操作） |
| play 无 track.url 不保护 | 加 `if (!now.track?.url) return {ok:false}` |
| XHR/fetch 无超时 | Deck: `AbortController` 15s，Switch: `xhr.timeout=15000` |
| 阻塞式音频预加载 | `audio.load()` 不和 `await audio.play()` 串行 |
| 数据库名用 `moodwave.db` | 实际文件是 `data/markradio.db` |

---

## SS3H / 服务器访问

### 默认凭据（不提交到仓库）
```bash
# 树莓派
ssh pi@192.168.2.33
# Steam Deck
ssh deck@192.168.3.121
```

### 快速命令
```bash
# 服务状态
ssh pi@192.168.2.33 "cd /home/pi/moodwave && bash scripts/moodwave.sh status"
ssh deck@192.168.3.121 "cd /home/deck/moodwave && bash scripts/moodwave.sh status"

# 查看日志
ssh pi@192.168.2.33 "tail -20 /home/pi/moodwave/moodwave.log"

# API 健康检查
curl http://192.168.2.33:8765/api/health
curl http://192.168.2.33:80/switch
```

## Steam Deck 网络配置

### 拓扑
| 设备 | IP | MAC | 连接名 |
|------|-----|-----|--------|
| Steam Deck | `192.168.3.121/24` | `50:5a:65:1d:24:f3` | NancyOpenWrt |
| 树莓派 | `192.168.2.33` | — | — |
| 路由器(旁路) | `192.168.3.254` | `92:23:b4:1f:cb:6c` | OpenWrt |

# 1. 提交代码
git add -A
git commit -m '描述改动'

# 2. 一键部署到两台机器
bash deploy.sh

# 3. 如果 deploy.sh 部分失败，手动补：
#    Deck:
#    rsync -avz --delete --exclude='node_modules' --exclude='.git' --exclude='.env' \
#      --exclude='data' --exclude='moodwave.log' --exclude='moodwave.pid' \
#      ./ deck@192.168.3.121:/home/deck/moodwave/
#    ssh deck@192.168.3.121 'cd ~/moodwave && bash scripts/moodwave.sh stop && bash scripts/moodwave.sh server'

# 4. Deck 游戏模式：重启 Steam 加载最新 Decky 插件
```

### 部署验证

| 机器 | 命令 |
|------|------|
| 树莓派 | `curl http://192.168.2.33:8765/api/health` |
| Steam Deck | `curl http://192.168.3.121:38765/api/health` |

期望：`{"ok":true,"name":"MoodWave","mode":"steamdeck"}`（或 `standard`）

## Steam Deck Mihomo 代理

### 开关
| 命令 | 作用 |
|------|------|
| `proxy-on` | 开启全系统代理 |
| `proxy-off` | 关闭全系统代理 |
| `proxy-status` | 查看代理状态 |
| `sudo systemctl start/stop mihomo` | 同上 |

### 文件位置
| 文件 | 说明 |
|------|------|
| `/usr/local/bin/mihomo` | 主程序 |
| `/etc/mihomo/config.yaml` | TUN 模式配置 + 订阅 |
| `/etc/systemd/system/mihomo.service` | 系统服务（默认不自启） |
| `~/Desktop/Proxy.desktop` | 桌面开关快捷方式 |

### 影响
- TUN 模式透明代理全系统流量
- 局域网 192.168.x.x/10.x/172.16.x 直连
- 关闭后路由自动恢复，无残留
- MoodWave 无需额外配置

## Steam Deck WiFi 最终结论（2026-05-25）

**根因：蓝牙干扰**，非软件问题。已回滚所有 WiFi 修复。

### 已回滚的修改
- `/etc/NetworkManager/dispatcher.d/99-wifi-powersave-off` ✅ 已删除
- `/etc/modprobe.d/rtw88.conf` ✅ 已删除
- `/etc/systemd/system/disable-wifi-aspm.service` ✅ 已删除
- `/etc/systemd/system/moodwave-wifi-resume.service` ✅ 已删除
- `/usr/local/bin/moodwave-wifi-resume.sh` ✅ 已删除
- NancyOpenWrt 恢复默认 DHCP 配置 ✅

### 保留
- Mihomo 代理（独立安装，不受影响）
- MoodWave 服务
