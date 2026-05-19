#!/usr/bin/env bash
##############################################
# MoodWave V5 — Steam Deck 一键安装
# 用法: bash install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git
# 小白友好版：只需提供仓库地址 + AI Key 即可完成全部安装
##############################################
set -euo pipefail

APP_NAME="MoodWave"
APP_PREFIX="${HOME}/.local/share/moodwave"
APP_CONFIG="${HOME}/.config/moodwave/config.env"
APP_PORT="38765"
APP_WEB_PORT="38080"
APP_MUSIC_DIR="${HOME}/Music"

REPO_URL=""
AI_PROVIDER="${AI_PROVIDER:-deepseek}"
AI_KEY="${AI_API_KEY:-}"
AI_BASE="${AI_BASE_URL:-}"
AI_MODEL="${AI_MODEL:-}"
FISH_KEY="${FISH_AUDIO_API_KEY:-}"
FISH_VOICE="${FISH_AUDIO_VOICE_ID:-}"
NETEASE_URL="${NETEASE_API_BASE:-}"
WEATHER_KEY="${OPENWEATHER_API_KEY:-}"
WEATHER_CITY="${OPENWEATHER_CITY:-}"
SKIP_PLUGIN=0
SKIP_DESKTOP=0

# ── 自动检测运行环境 ──
IS_SSH=0
[[ -n "${SSH_TTY:-}" || -n "${SSH_CONNECTION:-}" || -n "${SSH_CLIENT:-}" ]] && IS_SSH=1
IS_TTY=0
[[ -t 0 ]] && IS_TTY=1

# ── 配色 ──
BOLD='\033[1m'
GREEN='\033[32m'
YELLOW='\033[33m'
CYAN='\033[36m'
RESET='\033[0m'

say()     { printf "${GREEN}[MoodWave]${RESET} %s\n" "$1"; }
ask()     { printf "${CYAN}[?]${RESET} %s" "$1"; }
warn()    { printf "${YELLOW}[!]${RESET} %s\n" "$1" >&2; }
done_msg(){ printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
oops()    { printf "${YELLOW}[✗]${RESET} %s\n" "$1" >&2; exit 1; }

# ── 依赖检查（不阻塞） ──
check_bin() { command -v "$1" >/dev/null 2>&1; }

need() {
  if ! check_bin "$1"; then
    oops "缺少命令: $1 —— 请先安装：sudo pacman -S $1 --noconfirm（Steam Deck）或 apt install $1（树莓派）"
  fi
}

# ── 帮助 ──
usage() {
  cat <<'HELP'
MoodWave V5 — Steam Deck 一键安装

用法:
  bash install-steamdeck.sh --repo <Git仓库地址>

选项（全部可选，脚本会交互询问）:
  --repo <url>          Git 仓库地址（必填或交互输入）
  --ai-key <key>        AI API Key（DeepSeek / OpenAI 等）
  --provider <name>     AI 平台: deepseek(默认) | openai | qwen | gemini | custom
  --model <name>        AI 模型名（自动匹配平台）
  --api-base <url>      自定义 API 地址
  --skip-plugin         不安装 Decky 游戏模式插件
  --skip-desktop        不创建桌面快捷方式
  -h, --help            显示帮助

小白安装示例（一行搞定）:
  bash install-steamdeck.sh --repo https://github.com/zhaozhongyang2023/markradio.git

然后按提示输入 AI Key 即可。
HELP
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --ai-key) AI_KEY="$2"; shift 2 ;;
    --provider) AI_PROVIDER="$2"; shift 2 ;;
    --model) AI_MODEL="$2"; shift 2 ;;
    --api-base) AI_BASE="$2"; shift 2 ;;
    --skip-plugin) SKIP_PLUGIN=1; shift ;;
    --skip-desktop) SKIP_DESKTOP=1; shift ;;
    --fish-key) FISH_KEY="$2"; shift 2 ;;
    --fish-voice) FISH_VOICE="$2"; shift 2 ;;
    --netease-url) NETEASE_URL="$2"; shift 2 ;;
    --weather-key) WEATHER_KEY="$2"; shift 2 ;;
    --weather-city) WEATHER_CITY="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) oops "未知参数: $1（用 -h 查看帮助）" ;;
  esac
done

# ═══════════════════════════════════════════
# 第一步：欢迎 + 获取仓库地址
# ═══════════════════════════════════════════
clear 2>/dev/null || true
echo ""
echo "  ╔════════════════════════════════╗"
echo "  ║   🎵  MoodWave V5 安装向导    ║"
echo "  ║   AI DJ 电台 · Steam Deck 版  ║"
echo "  ╚════════════════════════════════╝"
echo ""

if [[ -z "$REPO_URL" && "$IS_TTY" = "1" ]]; then
  ask "请输入 MoodWave 的 Git 仓库地址（https://...）: "
  read -r REPO_URL
fi

[[ -z "$REPO_URL" ]] && oops "需要提供 Git 仓库地址。用法: bash install-steamdeck.sh --repo <地址>"

# ═══════════════════════════════════════════
# 第二步：获取 AI Key
# ═══════════════════════════════════════════
echo ""

if [[ -z "$AI_KEY" ]]; then
  echo "  MoodWave 需要 AI 来生成 DJ 推荐。"
  echo "  推荐使用 DeepSeek（便宜好用）：platform.deepseek.com"
  echo "  也支持 OpenAI / 通义千问 / Gemini"
  echo ""

  if [[ "$IS_TTY" = "1" ]]; then
    ask "AI Key（输入时不显示，粘贴后按回车）: "
    read -r -s AI_KEY
    echo ""
  else
    warn "未检测到终端输入，跳过 AI Key 配置（服务将以 Demo 模式运行）"
  fi
fi

[[ -z "$AI_KEY" ]] && say "未配置 AI Key，MoodWave 将以 Demo 模式运行（示例歌单）"

# ═══════════════════════════════════════════
# 语音 TTS（可选，不配也能用）
# ═══════════════════════════════════════════
FISH_KEY="${FISH_AUDIO_API_KEY:-}"
FISH_VOICE="${FISH_AUDIO_VOICE_ID:-}"

if [[ -z "$FISH_KEY" && "$IS_TTY" = "1" ]]; then
  echo ""
  echo "  ── 语音朗读（可选）──"
  echo "  MoodWave 会用 AI 朗读 DJ 开场白。"
  echo "  不配也能用，只是少一段开场语音。"
  echo "  Fish Audio 免费注册: fish.audio"
  echo ""
  ask "Fish Audio Key（跳过请直接回车）: "
  read -r -s FISH_KEY
  echo ""
  if [[ -n "$FISH_KEY" ]]; then
    ask "Fish Audio 音色 ID（跳过用默认）: "
    read -r FISH_VOICE
    echo ""
  fi
fi

# ═══════════════════════════════════════════
# 网易云音乐 API（可选，不配用 Demo 歌单）
# ═══════════════════════════════════════════
NETEASE_URL="${NETEASE_API_BASE:-}"

if [[ -z "$NETEASE_URL" && "$IS_TTY" = "1" ]]; then
  echo "  ── 音乐源（可选）──"
  echo "  不配会使用内置 Demo 歌单（可正常体验全部功能）。"
  echo "  配置网易云 API 后可播放真实歌曲。"
  echo "  推荐: github.com/Binaryify/NeteaseCloudMusicApi"
  echo ""
  ask "网易云 API 地址（跳过请直接回车）: "
  read -r NETEASE_URL
  echo ""
fi

# ═══════════════════════════════════════════
# 天气 API（可选，不配用本地默认）
# ═══════════════════════════════════════════
WEATHER_KEY="${OPENWEATHER_API_KEY:-}"
WEATHER_CITY="${OPENWEATHER_CITY:-}"

if [[ -z "$WEATHER_KEY" && "$IS_TTY" = "1" ]]; then
  echo "  ── 天气（可选）──"
  echo "  电台会根据天气调整推荐氛围。"
  echo "  不配也能用（默认晴天）。"
  echo "  免费注册: openweathermap.org"
  echo ""
  ask "OpenWeather Key（跳过请直接回车）: "
  read -r -s WEATHER_KEY
  echo ""
  if [[ -n "$WEATHER_KEY" ]]; then
    ask "你的城市（如 Beijing,CN）: "
    read -r WEATHER_CITY
    echo ""
  fi
fi

# 自动补全 AI 平台默认值
case "$AI_PROVIDER" in
  deepseek) [[ -z "$AI_BASE" ]] && AI_BASE="https://api.deepseek.com"; [[ -z "$AI_MODEL" ]] && AI_MODEL="deepseek-chat" ;;
  openai)   [[ -z "$AI_MODEL" ]] && AI_MODEL="gpt-5.5" ;;
  qwen)     [[ -z "$AI_BASE" ]] && AI_BASE="https://dashscope.aliyuncs.com/compatible-mode/v1"; [[ -z "$AI_MODEL" ]] && AI_MODEL="qwen-plus" ;;
  gemini)   [[ -z "$AI_BASE" ]] && AI_BASE="https://generativelanguage.googleapis.com/v1beta/openai"; [[ -z "$AI_MODEL" ]] && AI_MODEL="gemini-2.5-flash" ;;
esac

# ═══════════════════════════════════════════
# 第三步：检查环境（自动安装缺失依赖）
# ═══════════════════════════════════════════
echo ""
say "检查系统环境..."

need git
IS_STEAMOS=0
[[ -r /etc/os-release ]] && grep -qi "steamos\|steam deck" /etc/os-release && IS_STEAMOS=1

# ── 自动安装 Node.js ──
if ! check_bin node || ! check_bin npm; then
  if [[ "$IS_STEAMOS" = "1" ]]; then
    say "检测到 SteamOS，正在自动安装 Node.js..."
    # 初始化 pacman keyring（Steam Deck 首次需要）
    if [[ ! -d /etc/pacman.d/gnupg ]]; then
      warn "初始化 pacman 密钥环（需 sudo 密码）..."
      sudo pacman-key --init
      sudo pacman-key --populate archlinux holo
    fi
    sudo pacman -Sy --needed --noconfirm nodejs npm || oops "Node.js 安装失败，请手动执行: sudo pacman -S nodejs npm"
    done_msg "Node.js 安装完成"
  else
    oops "缺少 Node.js。请手动安装: apt install nodejs npm (树莓派) 或 sudo pacman -S nodejs npm (Arch)"
  fi
fi

NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VER" -lt 22 ]]; then
  oops "Node.js 版本过低 (需要 >= 22, 当前 $(node -v))。请升级后重试。"
fi
done_msg "Node.js $(node -v) ✓"

if [[ "$IS_STEAMOS" = "1" ]]; then
  done_msg "检测到 SteamOS ✓"
fi

# ═══════════════════════════════════════════
# 第四步：清理旧版本
# ═══════════════════════════════════════════
HAD_OLD_INSTALL=0
if [[ -d "$APP_PREFIX" ]]; then
  HAD_OLD_INSTALL=1
  say "检测到已有安装: ${APP_PREFIX}"
  if [[ "$IS_TTY" = "1" ]]; then
    ask "是否先清除旧版本再安装？[Y/n]: "
    read -r CLEAN
    echo ""
    [[ "$CLEAN" =~ ^[nN] ]] || CLEAN="y"
  else
    CLEAN="y"
  fi
  if [[ "$CLEAN" != "n" && "$CLEAN" != "N" ]]; then
    say "清除旧安装..."
    systemctl --user stop moodwave.service 2>/dev/null || true
    systemctl --user disable moodwave.service 2>/dev/null || true
    rm -rf "$APP_PREFIX"
    rm -rf "${HOME}/.config/systemd/user/moodwave.service" 2>/dev/null || true
    rm -f "${HOME}/Desktop/MoodWave.desktop" 2>/dev/null || true
    rm -rf "${HOME}/homebrew/plugins/moodwave-deck-companion" 2>/dev/null || true
    done_msg "旧版本已清除"
  else
    say "保留旧配置，覆盖安装"
  fi
fi

# ═══════════════════════════════════════════
# 第五步：下载代码
# ═══════════════════════════════════════════
say "下载 MoodWave 代码..."
rm -rf "${APP_PREFIX}.tmp" 2>/dev/null || true
git clone --depth 1 "$REPO_URL" "${APP_PREFIX}.tmp" || oops "Git 克隆失败，请检查仓库地址是否正确"
rm -rf "$APP_PREFIX" 2>/dev/null || true
mv "${APP_PREFIX}.tmp" "$APP_PREFIX"
done_msg "代码已下载到 ${APP_PREFIX}"

# ═══════════════════════════════════════════
# 第六步：写配置
# ═══════════════════════════════════════════
say "写入配置文件..."
mkdir -p "$(dirname "$APP_CONFIG")"
umask 077
cat > "$APP_CONFIG" <<EOF
# ── MoodWave 基础配置 ──
MOODWAVE_HOST=127.0.0.1
MOODWAVE_PORT=$APP_PORT
MOODWAVE_WEB_PORT=$APP_WEB_PORT
MOODWAVE_WEB_ORIGIN=http://127.0.0.1:$APP_WEB_PORT
APP_MODE=steamdeck
MUSIC_DIR=$APP_MUSIC_DIR

# ── AI 大脑 ──
AI_PROVIDER=$AI_PROVIDER
AI_BASE_URL=$AI_BASE
AI_MODEL=$AI_MODEL
AI_API_KEY=$AI_KEY

# ── 语音朗读（可选）──
FISH_AUDIO_API_KEY=$FISH_KEY
FISH_AUDIO_VOICE_ID=$FISH_VOICE
FISH_AUDIO_API_BASE=https://api.fish.audio

# ── 音乐源（可选，不配用 Demo 歌单）──
NETEASE_API_BASE=$NETEASE_URL

# ── 天气（可选）──
OPENWEATHER_API_KEY=$WEATHER_KEY
OPENWEATHER_CITY=$WEATHER_CITY

# ── 功能开关 ──
ENABLE_TTS=true
ENABLE_WEATHER=true
ENABLE_HOLIDAY=true
ENABLE_LOCATION=true
EOF
chmod 600 "$APP_CONFIG"
done_msg "配置已写入 ${APP_CONFIG}"

# ═══════════════════════════════════════════
# 第七步：安装依赖 + 构建
# ═══════════════════════════════════════════
say "安装依赖包（可能需要几分钟）..."
cd "$APP_PREFIX"
npm install --production --silent 2>&1 | tail -3
done_msg "依赖安装完成"

say "构建前端页面..."
npm run build 2>&1 | tail -3 || oops "构建失败，请检查 Node.js 版本 (需要 >= 22)"
done_msg "前端构建完成"

# ═══════════════════════════════════════════
# 第八步：创建后台服务
# ═══════════════════════════════════════════
say "创建系统后台服务..."
mkdir -p "${HOME}/.config/systemd/user" "${HOME}/.local/state/moodwave/logs"

cat > "${HOME}/.config/systemd/user/moodwave.service" <<EOF
[Unit]
Description=MoodWave AI DJ Radio
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_PREFIX}
Environment=MOODWAVE_CONFIG=${APP_CONFIG}
EnvironmentFile=${APP_CONFIG}
ExecStart=npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
done_msg "服务文件已创建"

# 尝试启动 systemd 用户服务
if systemctl --user list-jobs >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user enable --now moodwave.service 2>/dev/null || true

  if systemctl --user is-active moodwave.service >/dev/null 2>&1; then
    done_msg "后台服务已启动 ✓"
  else
    warn "服务未能自动启动，请稍后手动执行：systemctl --user start moodwave.service"
  fi
else
  warn "systemd 用户会话未就绪（常见于 SSH 首次安装）"
  echo ""
  echo "  请手动执行以下两个命令完成启动："
  echo ""
  echo "    loginctl enable-linger \$USER"
  echo "    systemctl --user enable --now moodwave.service"
  echo ""
  echo "  或临时手动启动："
  echo ""
  echo "    cd ${APP_PREFIX} && npm run start &"
  echo ""
fi

# ═══════════════════════════════════════════
# 第九步：桌面快捷方式
# ═══════════════════════════════════════════
if [[ "$SKIP_DESKTOP" = "0" ]]; then
  mkdir -p "${HOME}/Desktop"
  cat > "${HOME}/Desktop/MoodWave.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MoodWave
Comment=AI DJ 电台
Exec=xdg-open http://127.0.0.1:${APP_WEB_PORT}/?deck=1
Icon=applications-multimedia
Terminal=false
Categories=Audio;Music;
EOF
  chmod +x "${HOME}/Desktop/MoodWave.desktop"
  done_msg "桌面快捷方式已创建"
fi

# ═══════════════════════════════════════════
# 第十步：Decky 游戏模式插件
# ═══════════════════════════════════════════
if [[ "$SKIP_PLUGIN" = "0" && -d "${APP_PREFIX}/deck-companion" ]]; then
  say "安装 Decky 游戏模式插件..."
  plugin_src="${APP_PREFIX}/deck-companion"
  plugin_dest="${HOME}/homebrew/plugins/moodwave-deck-companion"

  if [[ -f "${plugin_src}/package.json" && ! -d "${plugin_src}/node_modules" ]]; then
    (cd "$plugin_src" && npm install --silent && npm run build) 2>&1 | tail -3
  fi

  if [[ -d "${HOME}/homebrew/plugins" ]]; then
    # Decky 插件目录通常属于 root，需要 sudo
    sudo rm -rf "$plugin_dest" 2>/dev/null || true
    sudo mkdir -p "$plugin_dest"
    sudo cp -r "${plugin_src}"/dist "${plugin_src}"/main.py "${plugin_src}"/plugin.json "${plugin_src}"/package.json "$plugin_dest/" 2>/dev/null || true
    sudo chown -R "${USER}:${USER}" "$plugin_dest" 2>/dev/null || true
    done_msg "Decky 插件已安装（重启 Steam 后生效）"
  else
    warn "未检测到 Decky Loader，跳过插件安装。（如需游戏模式使用，请先安装 Decky Loader）"
  fi
fi

# ═══════════════════════════════════════════
# 第十一步：健康检查
# ═══════════════════════════════════════════
say "启动服务并检查..."

# 如果 systemd 没启动成功，手动尝试
if ! pgrep -f "node server/index.js" >/dev/null 2>&1; then
  cd "$APP_PREFIX"
  NODE_ENV=production nohup node server/index.js > "${HOME}/.local/state/moodwave/logs/server.log" 2>&1 &
  sleep 2
fi

# 等待就绪
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# ═══════════════════════════════════════════
# 完成！
# ═══════════════════════════════════════════
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     🎉  MoodWave 安装完成！        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  📻  打开浏览器访问:"
echo "      ${BOLD}http://127.0.0.1:${APP_WEB_PORT}/?deck=1${RESET}"
echo ""
echo "  🎮  或双击桌面的 ${BOLD}MoodWave${RESET} 图标"
echo ""
echo "  ───────────────────────────────────"
echo "  文件位置:  ${APP_PREFIX}"
echo "  配置文件:  ${APP_CONFIG}"
echo "  ───────────────────────────────────"
echo ""
echo "  常用命令:"
echo "    查看状态:  systemctl --user status moodwave.service"
echo "    重启服务:  systemctl --user restart moodwave.service"
echo "    查看日志:  journalctl --user -u moodwave.service -f"
echo "    卸载重装:  bash ${APP_PREFIX}/scripts/uninstall-steamdeck.sh"
echo ""
