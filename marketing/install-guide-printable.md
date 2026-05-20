# MoodWave 安装手册（用户版）

> 预计 20～40 分钟 ｜ 零基础可操作 ｜ 全程复制粘贴

---

## 准备工作

### 你需要准备

- Steam Deck 联网
- **DeepSeek API Key**（免费获取，见附赠教程）
- 建议接 USB-C Hub + 键盘鼠标（触摸屏也能操作，只是慢一点）

### 进入桌面模式

按住 **电源键** → 选择「**切换至桌面模式**」

---

## 第一步：设置 sudo 密码（首次需要）

> 如果之前设过密码，跳过这一步。

左下角菜单 → **System Settings** → **Users** → 点你的用户名 deck → **Change Password**

设一个简单密码，比如 `deck`，后面安装要用。

---

## 第二步：打开终端

左下角菜单 → 搜索 `Konsole` → 打开黑色终端窗口。

> 以下所有命令，**逐行复制粘贴**到终端，按回车执行。

---

## 第三步：初始化系统（首次需要）

```bash
sudo pacman-key --init
sudo pacman-key --populate archlinux holo
```

看到 `gpg: Done` 就完成了。这一步只需做一次。

---

## 第四步：安装 Node.js

```bash
sudo pacman -Sy --needed --noconfirm nodejs npm
node -v
```

应该显示 v22 或更高版本号。

---

## 第五步：安装 MoodWave

```bash
git clone --depth 1 https://github.com/zhaozhongyang2023/markradio.git ~/moodwave
cd ~/moodwave
bash scripts/install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
```

### 安装过程会依次问你：

| 顺序 | 问题 | 怎么做 |
|------|------|--------|
| 1 | **AI Key** ⭐ | 粘贴你的 DeepSeek Key，**必须填** |
| 2 | Fish Audio Key | 语音朗读，**回车跳过** |
| 3 | 网易云 API 地址 | 真实音乐库，**回车跳过**（用 Demo 歌单） |
| 4 | OpenWeather Key | 天气感知，**回车跳过** |

> 最少只填一个 AI Key，其余全部回车跳过即可正常使用。

安装过程约 5～10 分钟，看到「🎉 MoodWave 安装完成！」就代表成功。

---

## 第六步：验证安装

### 桌面模式测试

浏览器打开：

```
http://127.0.0.1:38080/?deck=1
```

### 健康检查

```
http://127.0.0.1:38080/api/health
```

应该显示 `{"ok":true,"name":"MoodWave","mode":"steamdeck"}`

### 快速体验

1. 网页中点一个心情按钮（比如「平静」）
2. 等待 AI 生成 DJ 开场白和歌单
3. 点 ▶ 播放

听到音乐就成功了 ✅

---

## 第七步：安装 Decky Loader（游戏模式插件平台）

```bash
curl -L https://github.com/SteamDeckHomebrew/decky-loader/raw/main/dist/install_release.sh | sh
```

输入 sudo 密码，等待安装完成。

验证：回到游戏模式 → 按 `...` 按钮 → 左侧菜单底部出现 🔌 插件图标。

---

## 第八步：验证游戏模式

回到游戏模式 → 完全退出 Steam 再重新打开：

1. 按 Steam 键
2. 电源 → 重启 Steam
3. 按 `...` → 🔌 插件 → 看到 **MoodWave**

三个 Tab：
- 🎧 **AI Radio** — 按心情开电台
- 🎮 **Game Radio** — 选游戏氛围配 BGM
- 🔍 **AI 寻歌** — 告诉 AI 想听什么

---

## 日常使用

| 场景 | 怎么做 |
|------|--------|
| 白天打游戏听歌 | 游戏模式 → `...` → MoodWave → Game Radio |
| 晚上躺床听电台 | 桌面模式浏览器 `http://127.0.0.1:38080/?deck=1` |
| 换个心情 | Game Radio 选不同氛围，或 AI Radio 选不同心情 |
| 暂停/继续 | Decky 插件里点 ⏸/▶ |

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 克隆仓库失败 | 检查联网：`ping github.com` |
| `npm install` 卡住 | 换镜像源：`npm config set registry https://registry.npmmirror.com` |
| 网页打不开 | `systemctl --user restart moodwave.service` |
| 网页开了但没歌 | 检查 AI Key：`cat ~/.config/moodwave/config.env` |
| Decky 里找不到 MoodWave | 检查目录：`ls ~/homebrew/plugins/moodwave-deck-companion/` |
| 装完显示 Demo 歌单 | 正常现象。配置网易云 API 后可接入真实音乐库 |
| 怎么换 AI Key | 编辑 `~/.config/moodwave/config.env`，改 `AI_API_KEY=`，重启服务 |

---

## 升级到最新版

```bash
cd ~/moodwave
git pull
npm install --omit=dev
npm run build
systemctl --user restart moodwave.service
```

---

## 文件位置速查

| 东西 | 路径 |
|------|------|
| 主程序 | `~/moodwave` |
| 配置（含 AI Key） | `~/.config/moodwave/config.env` |
| 日志 | `~/.local/state/moodwave/logs/` |
| 桌面图标 | `~/Desktop/MoodWave.desktop` |
| Decky 插件 | `~/homebrew/plugins/moodwave-deck-companion` |
