# 🎵 MoodWave V6 — Steam Deck 完整安装手册

> 🆕 **已经装过旧版？** → [升级到最新版](#升级到最新版)

> 预计 20～40 分钟 ｜ 零基础可操作 ｜ 全程复制粘贴

---

## 准备工作

### 你需要的

- Steam Deck 联网
- 一个 **DeepSeek API Key**（免费注册：前往 [platform.deepseek.com](https://platform.deepseek.com) → 注册 → API Keys → 创建新 Key → 复制备用）
- 一把 **USB-C  Hub 接键盘鼠标**（推荐，触摸屏也能操作只是慢一点）

### 进入桌面模式

按住 **电源键** → 选择「**切换至桌面模式**」

---

## 第一步：设置密码（首次需要）

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
git clone --depth 1 https://github.com/zhaozhongyang2023/markradio.git ~/moodwave

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
| 3 | 网易云 API 地址 | 真实音乐库，**回车跳过**（用 Demo 歌单） |
| 4 | OpenWeather Key | 根据天气调氛围，**回车跳过** |

> 最少只填一个 AI Key，其余全部回车跳过即可正常使用。

安装过程约 5～10 分钟（主要是下载依赖包），看到「🎉 MoodWave 安装完成！」就代表成功。

---

## 第六步：验证安装

### 打开 MoodWave

桌面双击 **MoodWave** 图标，或浏览器打开：

```
http://127.0.0.1:38080/?deck=1
```

### 健康检查

浏览器打开：

```
http://127.0.0.1:38765/api/health
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

## 第七步：安装 Decky Loader（游戏模式插件平台）

> Decky Loader 是 Steam Deck 的插件平台，装好它才能装 MoodWave 的游戏模式插件。

### 7.1 下载安装脚本

桌面模式，浏览器打开：

```
https://github.com/SteamDeckHomebrew/decky-loader
```

或者直接终端执行：

```bash
curl -L https://github.com/SteamDeckHomebrew/decky-loader/raw/main/dist/install_release.sh | sh
```

输入 sudo 密码，等待安装完成。

### 7.2 验证 Decky 安装

- 回到 **游戏模式**（桌面双击「Return to Gaming Mode」或电源菜单切换）
- 按右侧 `...` 按钮（三个点）
- 左侧菜单底部应该出现 **🔌 插件图标**

如果看不到，重启一次 Steam Deck。

---

## 第八步：安装 MoodWave 游戏模式插件

### 插件已自动复制

安装脚本已经把插件文件放到了正确位置：

```
~/homebrew/plugins/moodwave-deck-companion/
```

### 重启 Steam 生效

回到游戏模式，**完全退出 Steam 再重新打开**：

1. 游戏模式中按 Steam 键
2. 电源 → 重启 Steam
3. 等 Steam 重新打开

### 验证

按 `...` 按钮 → 🔌 插件 → 应该看到 **MoodWave**

点击进入，能看到三个 Tab：

- 📻 **电台** — 按心情开电台
- 🔍 **寻歌** — 告诉 AI 想听什么
- 🎮 **游戏** — 选游戏氛围配 BGM

---

## 第九步：Game Radio 使用指南

### 打开

游戏模式中按 `...` → 🔌 插件 → MoodWave → 切换到 `🎮 Game Radio` Tab

### 操作流程

1. **选游戏氛围**
   - ⚔️ Boss战 —— 燃一点
   - ⌖ 探索地图 —— 适合慢慢跑图
   - ✧ 种田放松 —— 今天别太累了
   - ▣ 模拟器怀旧 —— 像小时候一样

2. **（可选）输入游戏名**
   - 比如输入「塞尔达」「老头环」「星露谷」

3. **点「▶ 开始游戏电台」**

> 💡 播放中可点「◁ 极简」进入极简模式，显示当前歌曲、天气、心情和场景文案（如「⌖ 探索地图 — 适合慢慢跑图」），适合游戏中快速查看。关闭插件后再打开会自动回到极简模式。

4. AI DJ 会：
   - 生成适合当前游戏场景的 DJ 开场白
   - 推荐歌单并显示推荐理由
   - 自动开始播放

5. 切回游戏继续打，音乐在后面放着

### 换氛围

在 Game Radio 页面点 **「↻ 换个氛围」**，AI 会重新配一批不同的歌。

### 手动切歌

按 `⏭` 跳到下一首。

---

## 日常使用

| 场景 | 怎么做 |
|------|--------|
| 白天打游戏听歌 | 游戏模式 → `...` → MoodWave → Game Radio |
| 晚上躺床听电台 | 桌面模式浏览器 `http://127.0.0.1:38080/?deck=1` |
| 换个心情 | Game Radio 选不同氛围，或 AI Radio 选不同心情 |
| 暂停/继续 | Decky 插件里点 ⏸/▶，或手柄映射快捷键 |

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

如果之前装过 MoodWave，只需更新代码并重启：

```bash
cd ~/moodwave
git pull
npm install --omit=dev
npm run build
systemctl --user restart moodwave.service

# 如果插件前端有改动，需额外重建并部署：
cd ~/moodwave/deck-companion
npm install --silent
npm run build
echo 你的密码 | sudo -S cp dist/index.js main.py plugin.json package.json ~/homebrew/plugins/moodwave-deck-companion/
```

> 重启 Steam（或 Decky → ⚙ → Reload Plugins）生效。


## 卸载

### 只卸载 MoodWave

```bash
bash ~/moodwave/scripts/uninstall-steamdeck.sh
```

### 卸载 Decky Loader

在游戏模式 Decky 设置里有个卸载按钮，或者在桌面模式执行安装脚本时的对应卸载命令。

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 克隆仓库失败 | 检查联网：`ping github.com` |
| `npm install` 卡住 | 网络问题。换镜像源：`npm config set registry https://registry.npmmirror.com` |
| 网页打不开 | `systemctl --user restart moodwave.service` |
| 网页开了但没歌 | 检查 AI Key 是否正确：`cat ~/.config/moodwave/config.env` |
| Decky 里找不到 MoodWave | 检查目录是否存在：`ls ~/homebrew/plugins/moodwave-deck-companion/` |
| 游戏电台没反应 | 确认本地 API 还在跑：`curl http://127.0.0.1:38765/api/health` |
| 装完显示 Demo 歌单 | 正常现象。配置网易云 API 后可接入真实音乐库 |
| 怎么换 AI Key | 编辑 `~/.config/moodwave/config.env`，改 `AI_API_KEY=`，然后重启服务 |
| 忘记 sudo 密码 | 桌面模式 → 系统设置 → 用户 → 改密码 |
| 极简模式显示"本地·未知" | 检查天气配置：`grep WEATHER ~/.config/moodwave/config.env`，不填则用默认天气 |

---

## 文件位置速查

| 东西 | 路径 |
|------|------|
| 主程序 | `~/moodwave` |
| 配置（含 AI Key） | `~/.config/moodwave/config.env` |
| 日志 | `~/.local/state/moodwave/logs/` |
| 桌面图标 | `~/Desktop/MoodWave.desktop` |
| Decky 插件 | `~/homebrew/plugins/moodwave-deck-companion` |
