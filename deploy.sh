#!/bin/bash
# 一键部署到 树莓派 + Steam Deck
# 用法:
#   ./deploy.sh              # 全部发布
#   ./deploy.sh pi           # 仅树莓派
#   ./deploy.sh deck         # 仅 Steam Deck
#   ./deploy.sh pi refresh   # 仅树莓派，刷新模式
#
# 前提: brew install sshpass (Mac) / sudo apt install sshpass (Linux)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 服务器配置 ──
PI_USER="${PI_USER:-pi}"
PI_HOST="${PI_HOST:-192.168.2.33}"
PI_DIR="${PI_DIR:-/home/pi/moodwave}"
PI_PASS="${PI_PASS:-Zzywo5201314}"
PI_RESTART="${PI_RESTART:-refresh}"

DECK_USER="${DECK_USER:-deck}"
DECK_HOST="${DECK_HOST:-192.168.3.121}"
DECK_DIR="${DECK_DIR:-/home/deck/moodwave}"
DECK_PASS="${DECK_PASS:-Zzywo5201314}"
DECK_RESTART="${DECK_RESTART:-refresh}"
DECK_PLUGIN_DIR="/home/deck/homebrew/plugins/moodwave-deck-companion"

# ── 目标选择 ──
TARGET="${1:-all}"
OVERRIDE_MODE="${2:-}"

case "$TARGET" in
  all|pi|deck) ;;
  *) echo "用法: $0 [all|pi|deck] [start|stop|refresh|server]"; exit 1 ;;
esac

red()    { echo -e "\033[31m$1\033[0m"; }
green()  { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
cyan()   { echo -e "\033[36m$1\033[0m"; }

# ── 远端执行（封装 sshpass）──
remote() {
  local user="$1" host="$2" pass="$3"; shift 3
  SSHPASS="$pass" sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$user@$host" "$@"
}

# ── 远端 rsync ──
remote_rsync() {
  local user="$1" host="$2" pass="$3"; shift 3
  SSHPASS="$pass" sshpass -e rsync -avz -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10" "$@"
}

# ── 远端 sudo（管道密码）──
remote_sudo() {
  local user="$1" host="$2" pass="$3"; shift 3
  SSHPASS="$pass" sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$user@$host" \
    "echo '$pass' | sudo -S $*"
}

# ── 部署到单台服务器 ──
deploy_to() {
  local label="$1" user="$2" host="$3" dir="$4" pass="$5" mode="$6"
  local mode_override="${OVERRIDE_MODE:-$mode}"

  cyan "========== 部署 $label: $user@$host =========="

  if ! remote "$user" "$host" "$pass" "echo ok" &>/dev/null; then
    red "  ✗ 无法连接 $host，跳过"; return 1
  fi
  green "  ✓ SSH 连通"

  # 1. 停止远端服务
  echo "  [1/3] 停止远端服务..."
  remote "$user" "$host" "$pass" "cd $dir && bash scripts/moodwave.sh stop" 2>/dev/null || yellow "  (服务可能未运行)"

  # 2. 同步文件
  echo "  [2/3] 同步文件..."
  remote_rsync "$user" "$host" "$pass" --delete \
    --exclude='node_modules' --exclude='.env' --exclude='*.pid' --exclude='*.log' \
    --exclude='firefox-kiosk-profile' --exclude='dist.bak' --exclude='backup' \
    --exclude='data' --exclude='.git' \
    "$PROJECT_DIR/dist/" "$user@$host:$dir/dist/"

  remote_rsync "$user" "$host" "$pass" --delete \
    --exclude='node_modules' --exclude='.env' \
    "$PROJECT_DIR/server/" "$user@$host:$dir/server/"

  remote_rsync "$user" "$host" "$pass" \
    "$PROJECT_DIR/scripts/moodwave.sh" "$user@$host:$dir/scripts/"

  remote_rsync "$user" "$host" "$pass" \
    "$PROJECT_DIR/package.json" "$PROJECT_DIR/package-lock.json" "$user@$host:$dir/"

  # Decky 插件同步（仅 Steam Deck）
  if [[ "$label" == *"Deck"* ]] && [ -d "$PROJECT_DIR/deck-companion/dist" ]; then
    echo "  [2b/3] 同步 Decky 插件..."
    remote_sudo "$user" "$host" "$pass" "sh -c \"rm -rf $DECK_PLUGIN_DIR 2>/dev/null; mkdir -p $DECK_PLUGIN_DIR\""
    remote_rsync "$user" "$host" "$pass" \
      "$PROJECT_DIR/deck-companion/dist" "$PROJECT_DIR/deck-companion/main.py" \
      "$PROJECT_DIR/deck-companion/plugin.json" "$PROJECT_DIR/deck-companion/package.json" \
      "$user@$host:/tmp/moodwave-deck-sync/"
    remote_sudo "$user" "$host" "$pass" \
      "sh -c \"cp -r /tmp/moodwave-deck-sync/* $DECK_PLUGIN_DIR/ && chmod -R a+rX $DECK_PLUGIN_DIR\""
    remote "$user" "$host" "$pass" "rm -rf /tmp/moodwave-deck-sync"
    green "  ✓ Decky 插件已同步"
  fi

  # 3. 重启服务
  echo "  [3/3] 远端执行: $mode_override..."
  remote "$user" "$host" "$pass" \
    "cd $dir && chmod +x scripts/moodwave.sh && bash scripts/moodwave.sh $mode_override"
  # 刷新 Decky 插件
  if [[ "$label" == *"Deck"* ]]; then
    echo "  [3b] 刷新 Decky 插件..."
    remote "$user" "$host" "$pass"       "nohup sh -c 'echo $pass | sudo -S systemctl restart plugin_loader' > /tmp/plugin_restart.log 2>&1 &"
    sleep 2
    green "  ✓ plugin_loader 重启中"

    echo "  [3c] 刷新 Steam 客户端..."
    remote "$user" "$host" "$pass" 'pkill -TERM -f "steam -srt" 2>/dev/null || true'
    sleep 3
    green "  ✓ Steam 重启中"
  fi

  # 确认状态
  echo ""
  sleep 3
  remote "$user" "$host" "$pass" "cd $dir && bash scripts/moodwave.sh status"

  green "========== $label 部署完成 =========="
  echo ""
}

echo "🚀 MoodWave 一键部署"
echo ""

# 构建前端
echo "[0] 构建前端..."
cd "$PROJECT_DIR"
npm run build --silent
green "  ✓ 构建完成"

# 构建 Decky 插件
if [[ "$TARGET" == "all" || "$TARGET" == "deck" ]]; then
  echo "[0b] 构建 Decky 插件..."
  cd "$PROJECT_DIR/deck-companion"
  npm run build --silent 2>/dev/null || yellow "  ⚠ deck-companion 构建失败"
  cd "$PROJECT_DIR"
  green "  ✓ Decky 插件构建完成"
fi
echo ""

errors=0

if [[ "$TARGET" == "all" || "$TARGET" == "pi" ]]; then
  deploy_to "🍓 树莓派" "$PI_USER" "$PI_HOST" "$PI_DIR" "$PI_PASS" "$PI_RESTART" || errors=$((errors + 1))
fi

if [[ "$TARGET" == "all" || "$TARGET" == "deck" ]]; then
  deploy_to "🕹️ Steam Deck" "$DECK_USER" "$DECK_HOST" "$DECK_DIR" "$DECK_PASS" "$DECK_RESTART" || errors=$((errors + 1))
fi

echo ""
if [ "$errors" -eq 0 ]; then
  green "✅ 全部部署完成！"
else
  red "⚠️ $errors 台服务器部署失败，请检查"
fi
