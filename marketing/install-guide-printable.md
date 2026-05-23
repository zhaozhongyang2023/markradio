# MoodWave 安装手册（用户版）

> 预计 20～40 分钟 ｜ 零基础可操作 ｜ 全程复制粘贴

---

## 准备工作

### 你需要准备

- Steam Deck 联网
- **DeepSeek API Key**（免费获取，见附赠教程）
- 建议接 USB-C Hub + 键盘鼠标（触摸屏也能操作，只是慢一点）

### ⚠️ 网络要求

> Fish Audio 和 OpenWeather 是**海外服务**，国内网络环境下可能无法直接访问。
> 如果计划使用这两个功能，Steam Deck 需要能够访问外网：

- 路由器已配置科学上网（推荐，全家设备通用）
- 或在 Steam Deck 桌面模式安装代理客户端（Clash / v2ray 等）
- **DeepSeek 不需要外网**，国内网络直连可用


## 📡 API Key 注册教程（跟着做就行）

> MoodWave 需要 3 个免费 API Key：DeepSeek（必填）、Fish Audio（语音可选）、OpenWeather（天气可选）。
> 每个注册只需 2 分钟，用手机也能操作。

---

### 一、DeepSeek API Key（必填 ⭐）

提供 AI DJ 大脑，没有它电台不会说话。

1. 打开手机/电脑浏览器，访问：
   **https://platform.deepseek.com**

2. 点击右上角「**注册 / Sign Up**」
   - 可以用手机号或邮箱注册
   - 输入验证码，设置密码

3. 登录后，进入控制台首页，点击左侧菜单「**API Keys**」

4. 点击「**创建 API Key**」按钮
   - 随便起个名字，比如 `moodwave`
   - 点「创建」

5. ⚠️ **立刻复制**弹窗里显示的 Key！
   - 格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxxxx`
   - **关掉弹窗后就再也看不到了**，必须马上保存

6. 💰 充值（新用户送 10 元额度，够用很久）：
   - 左侧菜单 →「**充值**」或访问 **https://platform.deepseek.com/top_up**
   - 最低充 1 元，微信/支付宝都可以
   - 10 块钱大概够 DJ 陪你聊几百小时

> ✅ 拿到 Key 后的样子：`sk-a1b2c3d4e5f6...`
> 📋 把这个 Key 记在手机备忘录里，安装时会用到。

---

### 二、Fish Audio API Key（可选 🎤）

给 DJ 配上真实人声朗读，不填就用文字版 DJ。

> 🌐 **需要外网** — fish.audio 是海外服务，注册和使用都需要科学上网。

1. 打开浏览器访问：
   **https://fish.audio**

2. 点击右上角「**Sign Up / 注册**」
   - 用邮箱注册，验证邮件

3. 登录后，点右上角头像 →「**API Keys**」
   - 或直接访问：**https://fish.audio/zh-CN/user/api-keys/**

4. 点击「**创建新 API Key**」
   - 起名 `moodwave`
   - 点创建

5. ⚠️ **立刻复制** Key！
   - 格式类似：`30c93842dd844b3a...`

6. 💰 充值（可选）：
   - 左侧菜单 →「充值」或直接访问 **https://fish.audio/zh-CN/user/billing/**
   - 新用户有免费额度，每天更新
   - 如果 DJ 说话没声音了，来这里充几块钱

> ✅ Key 格式：一串字母数字混合的字符串
> 📋 不填也可以用，DJ 就变成纯文字版，不影响听歌

---

### 三、OpenWeather API Key（可选 🌤️）

让 DJ 感知天气，在开场白里聊聊今天的温度、刮风下雨。

> 🌐 **需要外网** — openweathermap.org 是海外服务，注册需要科学上网。

1. 打开浏览器访问：
   **https://openweathermap.org**

2. 点击右上角「**Sign Up**」注册账号
   - 用邮箱注册，验证邮件

3. 登录后，点右上角用户名 →「**My API Keys**」
   - 或访问：**https://home.openweathermap.org/api_keys**

4. 系统已自动生成一个 Key（默认叫 `default`）
   - 直接复制它就行

5. ⚠️ 需要等 **10～30 分钟** Key 才会激活
   - 刚注册马上用可能会报错，等一会儿就好

> ✅ Key 格式：`908e8eb29e8f53...`
> 📋 不填也可以用，DJ 开场白会少一点天气话题，不影响听歌

---

## 🔑 Key 填哪里？

安装脚本运行时会依次问你：

```
请输入 DeepSeek API Key：     ← 粘贴 DeepSeek 的 Key
请输入 Fish Audio API Key：   ← 粘贴 Fish Audio 的 Key（可回车跳过）
请输入 OpenWeather API Key：  ← 粘贴 天气 API 的 Key（可回车跳过）
```

如果当时跳过了，之后可以在配置文件里补：
```bash
nano ~/.config/moodwave/config.env
```

改完保存后重启：
```bash
systemctl --user restart moodwave.service
```

---

> 💡 **只填 DeepSeek 就能用了**，另外两个是锦上添花。
> 三个 Key 都填满，DJ 会有声音 + 知道天气，体验最完整。

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
| 2 | Fish Audio Key | 语音朗读，**回车跳过**（填了 DJ 有说话声音） |
| 3 | 网易云 API 地址 | 真实音乐库，**回车跳过**（用 Demo 歌单） |
| 4 | OpenWeather Key | 天气感知，**回车跳过**（填了 DJ 聊天气） |

> 💡 **最少只填 DeepSeek Key 就能用**。三个 Key 都填满体验最完整（DJ 说话 + 感知天气）。

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
