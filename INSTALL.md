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
## （可选）Steam Deck 安装代理 — 提升 API 稳定性

> 🟢 **绝大多数用户不需要此步骤**。MoodWave 的 DeepSeek、Fish Audio 等 API 在国内可直接访问。
>
> 仅当你遇到以下情况才需要：
> - AI 生成 DJ 开场白经常失败
> - Music DNA 分析超时
> - 已确认是网络访问 API 不稳定

### 什么是代理

代理是一个网络中转工具，让你的 Steam Deck 更稳定地访问海外 API。**关闭后不影响任何功能**，跟没装一样。

### 准备工作

你需要一个 **Clash 订阅链接**（也叫"机场"）。如果你已经有梯子，找你的服务商要一个 Clash 订阅地址，类似：
```
https://xxx.xxx.com/link/xxxxxxxx
```

### 安装步骤

#### 1. 下载 mihomo（Clash 客户端）

打开终端（Konsole），逐行执行：

```bash
# 自动获取最新版 Linux amd64 安装包地址（不依赖 GitHub API）
rm -f /tmp/mihomo.gz /tmp/mihomo

MIHOMO_TAG=$(
  curl -fsSLI --retry 5 --retry-all-errors --connect-timeout 15 --max-time 60 \
    -o /dev/null -w '%{url_effective}' \
    https://github.com/MetaCubeX/mihomo/releases/latest |
  sed 's#.*/##'
)

if ! echo "$MIHOMO_TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "✗ 没拿到 mihomo 最新版本号，请检查网络或稍后重试"
  exit 1
fi

MIHOMO_URL="https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_TAG}/mihomo-linux-amd64-${MIHOMO_TAG}.gz"
echo "下载：$MIHOMO_URL"
curl -fL --retry 5 --retry-all-errors --connect-timeout 20 --max-time 300 \
  "$MIHOMO_URL" -o /tmp/mihomo.gz
gzip -t /tmp/mihomo.gz

# 解压并安装
gunzip -f /tmp/mihomo.gz
sudo mv /tmp/mihomo /usr/local/bin/mihomo
sudo chmod 755 /usr/local/bin/mihomo
mihomo -v
```

#### 2. 创建配置文件

把下面的 `YOUR_SUBSCRIPTION_URL` 替换成你的订阅链接，然后整段复制到终端执行：

```bash
sudo mkdir -p /etc/mihomo

sudo tee /etc/mihomo/config.yaml > /dev/null << 'YAML'
mixed-port: 7890
allow-lan: false
mode: rule
log-level: warning

proxy-providers:
  sub:
    type: http
    url: "YOUR_SUBSCRIPTION_URL"
    interval: 3600
    path: ./providers/sub.yaml
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 300

proxy-groups:
  - name: PROXY
    type: select
    use:
      - sub

tun:
  enable: true
  stack: system
  dns-hijack:
    - any:53
  auto-route: true
  auto-detect-interface: true

dns:
  enable: true
  listen: 0.0.0.0:5353
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://8.8.8.8/dns-query
    - https://1.1.1.1/dns-query

rules:
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - MATCH,PROXY
YAML
```

> ⚠️ **必须替换** `YOUR_SUBSCRIPTION_URL` 为你的真实订阅地址。

#### 3. 创建系统服务

```bash
sudo tee /etc/systemd/system/mihomo.service > /dev/null << 'EOF'
[Unit]
Description=Mihomo TUN Proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
```

#### 4. 配置免密码开关

```bash
# polkit 规则（桌面免密码）
sudo tee /etc/polkit-1/rules.d/50-mihomo.rules > /dev/null << 'JS'
polkit.addRule(function(action, subject) {
    if (action.id == "org.freedesktop.systemd1.manage-units" &&
        subject.user == "deck") {
        return polkit.Result.YES;
    }
});
JS

# 创建开关命令
sudo tee /usr/local/bin/proxy-on > /dev/null << 'SH'
#!/bin/bash
systemctl start mihomo && echo "✓ 代理已开启" || echo "✗ 开启失败"
SH
sudo chmod 755 /usr/local/bin/proxy-on

sudo tee /usr/local/bin/proxy-off > /dev/null << 'SH'
#!/bin/bash
systemctl stop mihomo && echo "✓ 代理已关闭" || echo "✗ 关闭失败"
SH
sudo chmod 755 /usr/local/bin/proxy-off

sudo tee /usr/local/bin/proxy-status > /dev/null << 'SH'
#!/bin/bash
systemctl status mihomo --no-pager
SH
sudo chmod 755 /usr/local/bin/proxy-status

# 桌面开关图标
cat > ~/Desktop/Proxy.desktop << 'END'
[Desktop Entry]
Type=Application
Name=Proxy
Comment=一键开关代理
Exec=/home/deck/.local/bin/proxy-dialog
Icon=network-vpn
Terminal=false
Categories=Network;
END
chmod +x ~/Desktop/Proxy.desktop
```

#### 5. 创建桌面弹窗脚本

```bash
mkdir -p ~/.local/bin

cat > ~/.local/bin/proxy-dialog << 'SCRIPT'
#!/bin/bash
STATUS=$(systemctl is-active mihomo)
if [ "$STATUS" = "active" ]; then
    TEXT="🟢 代理已开启"
    BTN_ON="保持开启"
    BTN_OFF="关闭代理"
else
    TEXT="🔴 代理已关闭"
    BTN_ON="开启代理"
    BTN_OFF="保持关闭"
fi

CHOICE=$(kdialog --title "Mihomo 代理" --radiolist "$TEXT" \
    on  "$BTN_ON"  on \
    off "$BTN_OFF" off 2>/dev/null)

case "$CHOICE" in
    on)  systemctl start mihomo
         kdialog --title "代理" --passivepopup "代理已开启" 3 ;;
    off) systemctl stop mihomo
         kdialog --title "代理" --passivepopup "代理已关闭" 3 ;;
esac
SCRIPT
chmod +x ~/.local/bin/proxy-dialog
```

### 使用方法

| 方式 | 操作 |
|------|------|
| 桌面双击 | 点 **Proxy** 图标 → 弹出窗口选开/关 |
| 终端命令 | `proxy-on` 开 / `proxy-off` 关 / `proxy-status` 查看 |

### 验证

```bash
# 先开启代理
proxy-on

# 测试外网（应返回 200）
curl -sI --max-time 10 https://www.google.com | head -1

# 确认局域网不受影响（MoodWave 应正常）
curl http://127.0.0.1:38765/api/health

# 关闭代理
proxy-off
```

### 影响说明

- **开机不自启**：重启后代理默认关闭，需要时手动开
- **全系统透明代理**：开启时所有流量走代理
- **局域网不受影响**：192.168.x.x 等内网地址永远直连
- **游戏模式可用**：切换到游戏模式后代理保持运行
- **关闭 = 不存在**：关闭后路由、DNS 完全恢复原状，无任何残留

### 卸载代理

```bash
sudo systemctl stop mihomo
sudo systemctl disable mihomo 2>/dev/null
sudo rm -f /usr/local/bin/mihomo
sudo rm -f /usr/local/bin/proxy-on /usr/local/bin/proxy-off /usr/local/bin/proxy-status
sudo rm -f /etc/systemd/system/mihomo.service
sudo rm -f /etc/polkit-1/rules.d/50-mihomo.rules
sudo rm -rf /etc/mihomo
rm -f ~/Desktop/Proxy.desktop ~/.local/bin/proxy-dialog
sudo systemctl daemon-reload
```

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

| 顺序 | 问题 | 怎么做 | 注册入口 |
|------|------|--------|
| 1 | **AI Key** ⭐ | 粘贴你的 DeepSeek Key，**必须填** | [platform.deepseek.com](https://platform.deepseek.com) → 注册 → API Keys → 创建 → 复制 |
| 2 | Fish Audio Key | 语音朗读 DJ 开场白，**建议填写** | [fish.audio](https://fish.audio) → 注册 → API Keys。Voice ID 在 Voices 页面选中文音色复制 |
| 3 | 网易云 API 地址 | 真实音乐库 + Music DNA，**建议填写** | 本地部署（见下方详解），填 `http://127.0.0.1:3000` |
| 4 | OpenWeather Key | 根据天气调氛围，**建议填写** | [openweathermap.org](https://openweathermap.org/api) → 免费注册 → API keys → 复制 |

> 最少只填一个 AI Key，其余全部回车跳过即可正常使用。

安装过程约 5～10 分钟（主要是下载依赖包），看到「🎉 MoodWave 安装完成！」就代表成功。

---

---

## 注册 API Key 详解

> 虽然只需 AI Key 就能用，但配齐下面四项后体验会完全不同：DJ 开口说话、歌单精准匹配、扫码导入红心歌单、天气感知氛围。

### DeepSeek（必填 ⭐）

1. 浏览器打开 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册账号（手机号即可）
3. 左侧菜单 → **API Keys** → 点击创建
4. 复制 Key，粘贴到安装脚本的 AI Key 提示处

> 新用户赠送 500 万 token 免费额度，日常使用足够很久。充值也很便宜，1 元约 100 万 token。

### Fish Audio（建议 — DJ 语音朗读）

1. 浏览器打开 [fish.audio](https://fish.audio)
2. 注册账号 → 进入控制台
3. 左侧 **API Keys** → 创建 Key → 复制
4. 左侧 **Voices** → 选一个中文音色 → 复制 Voice ID

> 安装时先填 API Key，再填 Voice ID。推荐音色：`Alex`（男声，沉稳）或 `Elena`（女声，温柔）。免费额度日常够用。

### 网易云 API（建议 — 真实音乐库 + Music DNA 扫码）

网易云 API 需要在 Steam Deck 上本地部署一个小服务。不用担心，Node.js 已经装好了，只需要三步：

```bash
# 1. 克隆网易云 API 项目
git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git ~/netease-api

# 2. 安装依赖
cd ~/netease-api && npm install

# 3. 启动服务（保持终端窗口开着）
node app.js
```

启动后会显示 `server running @ http://localhost:3000`。

安装 MoodWave 时，网易云 API 地址填：`http://127.0.0.1:3000`

> 💡 建议配好网易云 API 后再做 Music DNA（第七步），这样才能扫码导入你的网易云红心歌单和听歌记录，AI DJ 才能真正懂你的口味。用 Demo 歌单的话，音乐会比较随机。

> ⚠️ 网易云 API 服务不会开机自启。每次重启 Steam Deck 后，打开终端执行 `cd ~/netease-api && node app.js` 即可。

### OpenWeather（建议 — DJ 感知天气）

1. 浏览器打开 [openweathermap.org](https://openweathermap.org/api)
2. 点击 **Sign Up** 注册免费账号
3. 登录后进入 **API keys** 页面
4. 复制默认 Key（或创建一个新的）
5. 安装时填写 Key + 城市（格式：`Beijing,CN` / `Shanghai,CN`）

> 免费版每分钟 60 次调用，MoodWave 大概每 10 分钟查一次，完全够用。配好后 DJ 会说「外面下雨了，放点暖和的歌。」

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

V6 升级：Music DNA 从 3 维升级为 5 维——**核心情绪 / 聆听状态 / 音乐性格 / 游戏氛围 / 置信度**。DNA 直接参与选歌决策：匹配你口味的歌曲自动排到歌单前面，越用越精准。

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
