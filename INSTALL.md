# 🎵 MoodWave V6 — Steam Deck 完整安装手册

> 装好后，你的 Steam Deck 就多了一个长期陪伴的 AI DJ。🎧

> 🆕 **已经装过旧版？** → [升级到最新版](#升级到最新版)

> 预计 20～40 分钟 ｜ 零基础可操作 ｜ 全程复制粘贴

---

## 准备工作

### 你需要准备

- Steam Deck 联网
- 一个 **DeepSeek API Key**（免费，1 分钟搞定 👉 [platform.deepseek.com](https://platform.deepseek.com) → 注册 → API Keys → 创建，复制备用）
- 建议接 USB-C Hub + 键盘鼠标（触摸屏也能操作，只是慢一点）

### 进入桌面模式

按住 **电源键** → 选择「**切换至桌面模式**」

---

## 第一步：设置 sudo 密码（首次需要）

> 如果之前设过密码，跳过这一步。

左下角菜单 → **System Settings** → **Users** → 点你的用户名 deck → **Change Password**

设一个简单密码，比如 `deck`，后面装东西要用。

---

## 第二步：打开终端

左下角菜单 → 搜索 `Konsole` → 打开黑色终端窗口。

> 以下所有命令，**逐行复制粘贴**到终端，按回车执行。出现密码提示就输入刚才设的密码。

---

## 第三步：初始化系统（首次需要）

```bash
# 初始化 pacman 密钥环（Steam Deck 首次装软件需要）
sudo pacman-key --init
sudo pacman-key --populate archlinux holo
```

看到 `gpg: Done` 就完成了。这一步只需做一次。

---

## 第四步：安装 Node.js

```bash
# 安装 Node.js 和 npm
sudo pacman -Sy --needed --noconfirm nodejs npm

# 验证安装
node -v
npm -v
```

应该显示版本号（v22 或更高）。

---

## 第五步：安装 MoodWave

```bash
# 克隆项目到本地
git clone https://github.com/zhaozhongyang2023/markradio.git ~/moodwave

# 进入目录
cd ~/moodwave

# 一键安装
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

### 安装过程中会依次问你：

| 顺序 | 问题 | 怎么做 |
|------|------|--------|
| 1 | **AI Key** ⭐ | 粘贴你的 DeepSeek Key，**必须填** |
| 2 | Fish Audio Key | 语音朗读 DJ 开场白，**回车跳过** |
| 3 | 网易云 API 地址 | 真实音乐库 + Music DNA，**回车跳过**（用 Demo 歌单） |
| 4 | OpenWeather Key | 根据天气调氛围，**回车跳过** |

> 最少只填一个 AI Key，其余全部回车跳过即可正常使用。

安装过程约 5～10 分钟（主要是下载依赖包），看到「🎉 MoodWave 安装完成！」就代表成功。

---

## 第六步：验证安装

### 桌面模式测试

桌面双击 **MoodWave** 图标，或浏览器打开：

```
http://127.0.0.1:38080/?deck=1
```

### 健康检查

浏览器打开：

```
http://127.0.0.1:38080/api/health
```

应该显示：

```json
{"ok":true,"name":"MoodWave","mode":"steamdeck"}
```

### 快速体验

1. 网页中点一个心情按钮（比如「平静」）
2. 等待 AI 生成 DJ 开场白和歌单
3. 点 ▶ 播放

听到音乐就成功了 ✅

---

## 第七步：🎧 让 AI DJ 更懂你 — Music DNA（推荐）

这是 MoodWave 的核心功能。AI 分析你的网易云听歌记录，生成专属 **Music DNA**，三种模式都会参考。

V6 升级：Music DNA 变成三维结构——**核心情绪 / 聆听状态 / 音乐性格**，比简单的风格标签更深入。

### 操作流程

1. 网页中点「🎧 AI 正在学习你的音乐口味」
2. 扫码登录网易云
3. AI 自动读取你的红心、歌单、专辑
4. 输入你喜欢的关键词（如：久石让、JRPG OST、City Pop）
5. 点「生成我的音乐人格」
6. AI 分析完成 → 展示你的 Music DNA

```
✦ 你的 Music DNA
怀旧 / 平静 / 探索
JRPG OST / LoFi / City Pop
```

之后 AI Radio、AI Search、Game Radio 都会参考你的 Music DNA。越用越懂你。

---

## 第八步：安装 Decky Loader（游戏模式插件平台）

> Decky Loader 是 Steam Deck 的插件平台，装好它才能装 MoodWave 的游戏模式插件。

### 下载安装脚本

桌面模式，浏览器打开：

```
https://github.com/SteamDeckHomebrew/decky-loader
```

或者直接终端执行：

```bash
curl -L https://github.com/SteamDeckHomebrew/decky-loader/raw/main/dist/install_release.sh | sh
```

输入 sudo 密码，等待安装完成。

### 验证 Decky 安装

- 回到 **游戏模式**（桌面双击「Return to Gaming Mode」或电源菜单切换）
- 按右侧 `...` 按钮（三个点）
- 左侧菜单底部应该出现 **🔌 插件图标**

如果看不到，重启一次 Steam Deck。

---

## 第九步：验证游戏模式

游戏模式中 → 完全退出 Steam 再重新打开：

1. 按 Steam 键
2. 电源 → 重启 Steam
3. 按 `...` → 🔌 插件 → 看到 **MoodWave**

点击进入，三个 Tab：

- 🎧 **AI Radio** — 按心情开电台（参考 Music DNA + 情绪势能）
- 🎮 **Game Radio** — 选游戏氛围配 BGM（注入 DJ 灵魂 + 游戏世界感）
- 🔍 **AI 寻歌** — 告诉 AI 想听什么（参考 Music DNA）

> V6 新特性：Game Radio 输入游戏名（如「巫师3」），AI 自动感知**游戏世界氛围**，插件渲染**极简世界卡片**（天气+游戏+心情+vibe）。

---

## 日常使用

| 场景 | 怎么做 |
|------|--------|
| 白天打游戏听歌 | 游戏模式 → `...` → MoodWave → Game Radio → 输入游戏名 |
| 晚上躺床听电台 | 桌面模式浏览器 `http://127.0.0.1:38080/?deck=1` |
| 换个心情 | Game Radio 选不同氛围，或 AI Radio 选不同心情 |
| 暂停/继续 | Decky 插件里点 ⏸/▶ |
| AI 越用越懂你 | 定期更新 Music DNA，AI 口味越来越精准 |

---

## 管理命令速查

在桌面模式终端执行：

```bash
# 查看服务状态
systemctl --user status moodwave.service

# 重启服务
systemctl --user restart moodwave.service

# 停止服务
systemctl --user stop moodwave.service

# 查看实时日志
journalctl --user -u moodwave.service -f

# 更新到最新版
cd ~/moodwave && git pull && npm install --production && npm run build && systemctl --user restart moodwave.service
```

---

## 升级到最新版

```bash
cd ~/moodwave
git pull
npm install --omit=dev
npm run build
systemctl --user restart moodwave.service
```

> Decky 插件会自动跟随 Steam 重启加载最新版。如果没更新，游戏模式 → Decky → ⚙ → Reload Plugins。

---

## 卸载

### 只卸载 MoodWave

```bash
bash ~/moodwave/scripts/uninstall-steamdeck.sh
```

### 卸载 Decky Loader

在游戏模式 Decky 设置里有卸载按钮。

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 克隆仓库失败 | 检查联网：`ping github.com` |
| `npm install` 卡住 | 换镜像源：`npm config set registry https://registry.npmmirror.com` |
| 网页打不开 | `systemctl --user restart moodwave.service` |
| 网页开了但没歌 | 检查 AI Key：`cat ~/.config/moodwave/config.env` |
| Decky 找不到 MoodWave | 检查目录：`ls ~/homebrew/plugins/moodwave-deck-companion/` |
| Game Radio 没反应 | 确认本地 API 还在跑：`curl http://127.0.0.1:38765/api/health` |
| 装完显示 Demo 歌单 | 正常现象。配置网易云 API + 生成 Music DNA 后更精准 |
| 怎么换 AI Key | 编辑 `~/.config/moodwave/config.env`，改 `AI_API_KEY=`，重启服务 |
| 忘记 sudo 密码 | 桌面模式 → 系统设置 → 用户 → 改密码 |
| **如何获取最新版？** | `git pull` [更新命令](#升级到最新版)，GitHub Watch 本仓库获取更新通知 |
| **遇到问题找谁？** | 看下方 [支持与服务](#-支持与服务) |
| **Music DNA 怎么重新生成？** | 网页设置页 → Music DNA → [重置] → 重新扫码导入 |
| **AI 推荐不够精准？** | 检查 Music DNA 是否已生成：`curl http://127.0.0.1:38765/api/profile/music-dna` |

---

## 文件位置速查

| 东西 | 路径 |
|------|------|
| 主程序 | `~/moodwave` |
| 配置（含 AI Key） | `~/.config/moodwave/config.env` |
| Music DNA 数据 | `~/.config/moodwave/data/` |
| 日志 | `~/.local/state/moodwave/logs/` |
| 桌面图标 | `~/Desktop/MoodWave.desktop` |
| Decky 插件 | `~/homebrew/plugins/moodwave-deck-companion` |

---

## 🛟 支持与服务

- 📹 安装遇到问题？B 站搜「**十三哥玩点啥**」看视频教程
- 🛒 不想自己折腾？闲鱼搜「**MoodWave**」获取远程协助 + 终身技术支持
- 🔄 终身免费更新，GitHub Watch 本仓库获取更新通知
