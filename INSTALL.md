# 🎵 MoodWave V5 — Steam Deck 安装指南

> **一句话说明**：把 Steam Deck 变成一个 AI DJ 电台，玩游戏时自动放合适的歌。

⏱ 耗时：10～20 分钟（取决于网速）
🎯 难度：会用桌面模式即可

---

## 准备：进入桌面模式

按住 **电源键** → 选择「**切换至桌面模式**」

如果没设过密码：左下角菜单 → System Settings → Users → 改密码（比如设成 `deck`）

---

## 方法一：一行命令安装（推荐 ⭐）

打开终端（左下角菜单搜 `Konsole`），复制粘贴这一行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/zhaozhongyang2023/markradio/main/release/install-moodwave.sh) --repo https://github.com/zhaozhongyang2023/markradio.git
```

> ⚠️ 把两个地址换成你自己的。脚本会自动完成所有安装。

然后脚本会依次问你几个问题（**全部可以直接回车跳过**）：

1. **AI Key**（必填）— DeepSeek / OpenAI 的 API Key
2. **语音 Key**（可选）— [Fish Audio](https://fish.audio) 的 Key，用来朗读 DJ 开场白
3. **网易云 API 地址**（可选）— 接入真实音乐库，不填用 Demo 歌单
4. **天气 Key**（可选）— [OpenWeather](https://openweathermap.org) 的 Key，电台会根据天气调氛围

> 🔑 至少填一个 **AI Key**（去 [platform.deepseek.com](https://platform.deepseek.com) 免费注册），其余都可以回车跳过。

---

## 方法二：先下载再安装

如果你的仓库是私有的，或者不想用 curl 管道：

```bash
# 1. 克隆项目
git clone https://github.com/zhaozhongyang2023/markradio.git ~/.local/share/moodwave

# 2. 进入目录
cd ~/.local/share/moodwave

# 3. 一键安装
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

同样是依次问 AI Key → 语音 → 音乐源 → 天气，全部可跳过。

---

## 安装后启动服务（首次 SSH 安装需要）

如果安装脚本最后提示 `systemd 用户会话未就绪`，执行：

```bash
loginctl enable-linger $USER
systemctl --user enable --now moodwave.service
```

> 桌面模式安装通常不需要这步，会自动启动。

---

## 打开 MoodWave

浏览器访问（或双击桌面 MoodWave 图标）：

```
http://127.0.0.1:38080/?deck=1
```

看到 AI DJ 电台界面就是成功了 ✅

---

## 安装 Decky 插件（游戏模式里用）

### 1. 先装 Decky Loader

桌面模式浏览器打开 https://github.com/SteamDeckHomebrew/decky-loader ，按说明安装。

### 2. 装好 Decky 后，回到游戏模式

按 `...` 按钮 → 插件 → MoodWave → 就能边打游戏边听 AI 电台

> 安装脚本会自动把插件文件放到 `~/homebrew/plugins/`，重启 Steam 生效

---

## 验证是否正常运行

浏览器打开：

```
http://127.0.0.1:38080/api/health
```

显示 `{"ok":true,"name":"MoodWave"}` 就对了。

---

## 常见问题

| 问题 | 怎么解决 |
|------|----------|
| 提示"缺少命令: git" | `sudo pacman -S git --noconfirm` |
| 提示"缺少命令: node" | `sudo pacman -S nodejs npm --noconfirm` |
| 提示 Node.js 版本太低 | `sudo pacman -Syu nodejs npm --noconfirm` |
| `systemctl --user` 报错 | 先执行 `loginctl enable-linger $USER`，重启再试 |
| 网页打不开 | `systemctl --user status moodwave.service` 看状态，或 `cd ~/.local/share/moodwave && npm run start &` |
| 能打开但没歌 | 没配 AI Key 会进 Demo 模式（示例歌单），配了 Key 就好了 |
| 想换 AI 平台 | 编辑 `~/.config/moodwave/config.env`，改 `AI_PROVIDER` 和 `AI_API_KEY`，然后 `systemctl --user restart moodwave.service` |
| 怎么更新 | `cd ~/.local/share/moodwave && git pull && npm install --production && npm run build && systemctl --user restart moodwave.service` |
| 怎么卸载 | `bash ~/.local/share/moodwave/scripts/uninstall-steamdeck.sh` |

---

## 文件位置速查

| 位置 | 说明 |
|------|------|
| `~/.local/share/moodwave` | 主程序 |
| `~/.config/moodwave/config.env` | 配置文件（AI Key 在这里） |
| `~/.config/systemd/user/moodwave.service` | 后台服务 |
| `~/.local/state/moodwave/logs/` | 日志 |
| `~/Desktop/MoodWave.desktop` | 桌面快捷方式 |
| `~/homebrew/plugins/moodwave-deck-companion` | Decky 游戏模式插件 |

---

## 后台服务管理

```bash
systemctl --user status moodwave.service     # 查看状态
systemctl --user restart moodwave.service    # 重启
systemctl --user stop moodwave.service       # 停止
journalctl --user -u moodwave.service -f     # 实时日志
```
