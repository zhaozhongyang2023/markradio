# MoodWave V5

MoodWave 是一个懂用户当前状态的 AI DJ 电台。用户只需要选择心情，或者输入一句“现在想听什么”，剩下由 MoodWave 自动完成：DJ 开场白、歌单、推荐理由、TTS 朗读和播放。

V5 保留原稳定版能力：树莓派、手机移动端、MacBook 浏览器/PWA 都继续运行；同时新增 Steam Deck 桌面模式和游戏模式支持。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev:api
```

另开一个终端：

```bash
npm run dev:web
```

开发访问：`http://localhost:8080`。

## 树莓派部署

默认地址保持兼容：

- Web/PWA：`http://192.168.2.33:8080`
- API：`http://192.168.2.33:8765`

```bash
npm install
cp .env.example .env
npm run build
npm start
```

旧部署脚本仍保留：

```bash
./deploy.sh 192.168.2.33
```

## Steam Deck 一键安装

详细图文指南 → [INSTALL.md](./INSTALL.md)

### 一行命令安装（推荐）

```bash
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

脚本会问一个简单问题：**你的 AI Key 是什么？**

粘贴进去，回车，等待完成即可。

### SSH 远程安装

```bash
# SSH 进 Steam Deck，同样一行：
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git --ai-key sk-你的密钥
```

安装后启用后台服务：

```bash
loginctl enable-linger $USER
systemctl --user enable --now moodwave.service
```

默认安装路径：

- 主程序：`~/.local/share/moodwave`
- 配置：`~/.config/moodwave/config.env`
- systemd 用户服务：`~/.config/systemd/user/moodwave.service`
- 日志：`~/.local/state/moodwave/logs`
- 桌面快捷方式：`~/Desktop/MoodWave.desktop`

默认 Steam Deck 端口：

- API：`http://127.0.0.1:38765`
- Web/PWA：`http://127.0.0.1:38080/?deck=1`

## 故障排查

| 现象 | 解决方案 |
|------|----------|
| SSH 安装时 `read: stdin: not a tty` | 添加 `--non-interactive` 并通过环境变量传参 |
| `systemctl --user` 报 `Failed to connect to bus` | 执行 `loginctl enable-linger $USER` |
| `npm run build` 失败 | 检查 Node.js >= 22.5: `node -v` |
| 服务启动但无法访问 | 检查: `curl http://127.0.0.1:38765/api/health` |
| 树莓派部署后无 Firefox 全屏 | SSH 模式下自动跳过图形界面 |

诊断和卸载：

```bash
bash scripts/doctor-steamdeck.sh
bash scripts/uninstall-steamdeck.sh
```

卸载时会询问是否保留配置文件和 API Key。默认保留，方便下次重装少输入一次密钥。

```bash
bash scripts/uninstall-steamdeck.sh --keep-config
bash scripts/uninstall-steamdeck.sh --remove-config
```

## Decky 插件

插件目录：`deck-companion/`

`MoodWave Deck Companion` 只负责 Steam Deck 游戏模式 UI、AI Radio、AI 寻歌、当前播放控制和 AI DJ 文案展示。它不保存第三方密钥，不做音频解码，不做 AI 推理，不生成 TTS。

插件默认调用：

```text
http://127.0.0.1:38765
```

也可以在插件里改为树莓派 API 地址。

## V5 API

旧接口保持兼容：

- `GET /api/status`
- `GET /api/now`
- `GET /api/mood` / `PUT /api/mood`
- `GET /api/plan/today` / `POST /api/plan/today`
- `POST /api/chat`
- `POST /api/playback/:action`
- `GET /ws/stream`

Steam Deck / V5 语义接口：

- `GET /api/health`
- `POST /api/ai/radio`
- `POST /api/ai/search`
- `POST /api/ai/next-radio`
- `POST /api/play`
- `POST /api/pause`
- `POST /api/next`
- `POST /api/prev`

## 配置

开发和树莓派继续支持仓库根目录 `.env`。

Steam Deck 安装器默认写入：

```text
~/.config/moodwave/config.env
```

支持的 AI 平台：

- DeepSeek
- OpenAI
- 通义千问 Qwen
- Gemini
- 自定义 OpenAI-compatible API

密钥只写入本机配置文件，权限设置为 `600`。

## 安全边界

- 不提交 `.env`、`config.env`、`data/`、缓存、构建产物。
- 前端和 Decky 插件不包含第三方 API Key。
- 安装脚本不打印用户输入的 API Key。
- 未配置音乐源时仍可进入 Demo 模式体验。

## 发布打包

```bash
node scripts/package-steamdeck.mjs
```

输出目录：`release/`

产物：

- `moodwave-v5.tar.gz`
- `install-moodwave.sh`
- `moodwave-deck-companion.zip`
- `checksums.txt`
