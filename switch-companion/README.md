# MoodWave Switch Companion

Nintendo Switch AI DJ 电台伴侣插件。

## 安装

### 1. 启动 MoodWave 服务

在电脑或树莓派上确保 MoodWave API 正在运行：

```bash
cd moodwave-radio
npm start
```

### 2. Switch 上使用

#### 方式 A：NRO 启动器（推荐）

将 `dist/moodwave.nro` 复制到 SD 卡 `switch/` 目录。
通过 Homebrew Menu 启动「MoodWave Switch Companion」，
自动唤起 Switch 浏览器打开电台页面。

如未预编译 NRO，需要先编译（需要 devkitPro）：

```bash
cd switch-companion/launcher
# 修改 main.c 中的 MOODWAVE_URL，替换为你的服务器 IP
make
cp moodwave.nro ../dist/
```

#### 方式 B：手动浏览器访问

在 Switch 上打开浏览器 homebrew（nx-bred 等），
输入地址：

```
http://{你的服务器IP}:8765/switch
```

或（如果 Web 服务开启）：

```
http://{你的服务器IP}:8080/switch
```

## UI 说明

界面复刻 Steam Deck Decky 插件游戏模式：

- **电台**：选心情，AI DJ 自动生成歌单
- **寻歌**：自然语言描述想听的歌
- **游戏**：选游戏氛围，AI 感知场景
- 极简模式：世界卡片 + 曲目 + 播放控制
- 手柄方向键焦点导航，触摸友好

## 文件结构

```
switch-companion/
├── plugin.json        # 插件元信息
├── README.md          # 本文件
├── src/
│   └── index.html     # Switch 前端（纯 HTML/CSS/JS）
├── launcher/
│   ├── main.c         # NRO 启动器源码
│   └── Makefile       # devkitPro 编译配置
└── dist/
    └── moodwave.nro   # 预编译 NRO
```
