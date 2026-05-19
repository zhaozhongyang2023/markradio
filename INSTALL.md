# 🎵 MoodWave V5 — Steam Deck 完整安装与验证指南

> 耗时：15～30 分钟（取决于网速）
> 难度：⭐ 会用桌面模式即可，全程复制粘贴

---

## 第一步：进入桌面模式

1. 按 **Steam 键** → 「电源」→「切换至桌面模式」
2. 等系统进入 KDE Plasma 桌面

---

## 第二步：打开终端

左下角菜单 → 搜 `Konsole` → 打开

> 以下所有命令，逐行复制到终端，按回车执行。

---

## 第三步：安装 Node.js（如果还没装）

```bash
# 检查是否已安装
node -v
```

如果显示 `command not found`，执行安装：

```bash
# 初始化 pacman 密钥环（Steam Deck 首次需要）
sudo pacman-key --init
sudo pacman-key --populate archlinux holo

# 安装 Node.js 和 npm
sudo pacman -Sy --needed --noconfirm nodejs npm

# 验证
node -v   # 应显示 v22 或更高
npm -v    # 应显示 10.x 或更高
```

> 提示输入密码时，输入你设的 sudo 密码（不显示是正常的）

---

## 第四步：确保 Git 已安装

```bash
git --version
```

如果没装：`sudo pacman -S --needed git --noconfirm`

---

## 第五步：克隆 + 一键安装

> ⚠️ **如果你之前装过**：安装脚本会检测到旧版本并询问是否清除。
> 选 Y（默认）会彻底清理旧程序、旧服务、旧桌面图标，保持干净后再安装。
> 旧配置文件（`~/.config/moodwave/config.env`）不会被删除，重装后仍保留你的 AI Key。

## 第五步：克隆 + 一键安装

```bash
# 克隆项目
git clone --depth 1 https://github.com/zhaozhongyang2023/markradio.git ~/moodwave

# 进入目录
cd ~/moodwave

# 一键安装（脚本会依次问 AI Key、语音、音乐源、天气，全部可回车跳过）
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

### 安装过程中会问你：

| 问题 | 做什么 |
|------|--------|
| Git 仓库地址 | 已通过 `--repo` 传入，自动跳过 |
| **AI Key** ⭐ | 至少填这个。去 [platform.deepseek.com](https://platform.deepseek.com) 免费注册 → API Keys → 创建 → 粘贴 |
| 语音 Key | Fish Audio 的 Key，用于 DJ 朗读开场白。跳过也可 |
| 网易云 API 地址 | 真实音乐源。跳过用 Demo 歌单 |
| 天气 Key | OpenWeather 免费注册。跳过用默认晴天 |

> **最少只需要一个 DeepSeek AI Key**，其余全部回车跳过即可正常使用。

---

## 第六步：启用后台服务

如果安装脚本最后提示 `systemd 用户会话未就绪`，执行：

```bash
# 允许后台服务持久化（只需一次）
loginctl enable-linger $USER

# 启动服务
systemctl --user daemon-reload
systemctl --user enable --now moodwave.service

# 检查
systemctl --user status moodwave.service
```

看到 `active (running)` ✅

> 如果桌面模式安装，通常会自动启动，这步可跳过。

---

## 第七步：打开 MoodWave

### 方式一：桌面图标

双击桌面上的 **MoodWave** 图标

### 方式二：浏览器

打开浏览器，地址栏输入：

```
http://127.0.0.1:38080/?deck=1
```

---

## 第八步：验证运行

### 8.1 健康检查

浏览器打开：

```
http://127.0.0.1:38080/api/health
```

应显示：

```json
{"ok":true,"name":"MoodWave","mode":"steamdeck"}
```

### 8.2 完整状态

```
http://127.0.0.1:38080/api/status
```

应显示 AI、语音、音乐源等配置状态。

### 8.3 试试 AI DJ

在浏览器界面：
1. 点一个心情（比如"平静"）
2. 等待 AI 生成 DJ 开场白和歌单
3. 点播放按钮 ▶

听到电台就成功了 🎉

---

## 第九步：安装 Decky 游戏模式插件

### 9.1 安装 Decky Loader

桌面模式浏览器打开：

```
https://github.com/SteamDeckHomebrew/decky-loader
```

按页面说明安装（通常是一行命令执行即可）。

### 9.2 安装 MoodWave 插件（已自动完成）

安装脚本已自动把插件文件放到 `~/homebrew/plugins/moodwave-deck-companion/`。

重启 Steam，回到游戏模式，按 `...` 按钮 → Decky 插件 → MoodWave → 看到三个 Tab：

- 🎧 **AI Radio** — 按心情开电台
- 🎮 **Game Radio** — 选游戏氛围配 BGM
- 🔍 **AI 寻歌** — 告诉 AI 想听什么

---

## 验证清单

逐项检查，全部打勾即安装成功：

- [ ] `systemctl --user status moodwave.service` 显示 `active (running)`
- [ ] 浏览器 `http://127.0.0.1:38080/api/health` 返回 `{"ok":true}`
- [ ] 浏览器 `http://127.0.0.1:38080/?deck=1` 显示 MoodWave 界面
- [ ] 点一个心情 → AI 生成歌单 → 点播放能听到
- [ ] 桌面 MoodWave 图标双击能打开
- [ ] Decky 插件里能看到三个 Tab
- [ ] Game Radio Tab 选择氛围 → 点开始电台 → 返回推荐

---

## 常见问题

| 问题 | 解决 |
|------|------|
| `pacman-key --init` 报错 | 正常现象，等它跑完即可（生成密钥需要时间） |
| 克隆仓库失败 | 检查是否联网：`ping github.com` |
| `npm install` 卡住 | 网络问题。试试 `npm install --registry https://registry.npmmirror.com` |
| 网页打不开 | `systemctl --user restart moodwave.service` |
| 网页开了但没歌 | 没配 AI Key 会进 Demo 模式。编辑 `~/.config/moodwave/config.env` 填上 Key，重启服务 |
| 服务启动失败看日志 | `journalctl --user -u moodwave.service -n 50` |
| 怎么更新 | `cd ~/moodwave && git pull && npm install --production && npm run build && systemctl --user restart moodwave.service` |
| 怎么卸载 | `bash ~/moodwave/scripts/uninstall-steamdeck.sh` |

---

## 文件位置速查

| 东西 | 路径 |
|------|------|
| 主程序 | `~/moodwave` |
| 配置文件 | `~/.config/moodwave/config.env` |
| 后台服务 | `~/.config/systemd/user/moodwave.service` |
| 日志 | `~/.local/state/moodwave/logs/` |
| 桌面图标 | `~/Desktop/MoodWave.desktop` |
| Decky 插件 | `~/homebrew/plugins/moodwave-deck-companion` |

---

## 管理命令速查

```bash
# 服务状态
systemctl --user status moodwave.service

# 重启
systemctl --user restart moodwave.service

# 停止
systemctl --user stop moodwave.service

# 实时日志
journalctl --user -u moodwave.service -f

# 手动启动（调试用）
cd ~/moodwave && node server/index.js

# 更新到最新版
cd ~/moodwave && git pull && npm install --production && npm run build && systemctl --user restart moodwave.service
```
