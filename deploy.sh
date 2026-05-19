#!/bin/bash
# 部署到树莓派 — 在树莓派同一局域网执行
# 用法: ./deploy.sh [pi_host] [start|stop|refresh|server]

set -e
PI_HOST="${1:-192.168.2.33}"
REMOTE_MODE="${2:-start}"
PI_USER="${PI_USER:-pi}"
PI_DIR="${PI_DIR:-/home/pi/markradio}"
PI_SSH_KEY="${PI_SSH_KEY:-}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$REMOTE_MODE" in
  start|stop|refresh|server) ;;
  *)
    echo "用法: $0 [pi_host] [start|stop|refresh|server]"
    exit 1
    ;;
esac

SSH_OPTS=()
RSYNC_SSH="ssh"
if [ -n "$PI_SSH_KEY" ]; then
  SSH_OPTS=(-i "$PI_SSH_KEY" -o IdentitiesOnly=yes)
  RSYNC_SSH="ssh -i $PI_SSH_KEY -o IdentitiesOnly=yes"
fi

echo "========== 部署 MoodWave 到 $PI_USER@$PI_HOST =========="
echo ""

# 1. 构建前端
echo "[1/4] 构建前端..."
cd "$PROJECT_DIR"
npm run build --silent

# 2. 停止服务
echo "[2/4] 停止远端服务..."
ssh "${SSH_OPTS[@]}" "$PI_USER@$PI_HOST" "cd $PI_DIR && bash scripts/markradio.sh stop" 2>/dev/null || echo "  (服务可能未运行)"

# 3. 同步文件
echo "[3/4] 同步文件..."
rsync -avz --delete \
  -e "$RSYNC_SSH" \
  "$PROJECT_DIR/dist/" \
  "$PI_USER@$PI_HOST:$PI_DIR/dist/"

rsync -avz --delete \
  -e "$RSYNC_SSH" \
  "$PROJECT_DIR/server/" \
  "$PI_USER@$PI_HOST:$PI_DIR/server/"

rsync -avz \
  -e "$RSYNC_SSH" \
  "$PROJECT_DIR/scripts/markradio.sh" \
  "$PROJECT_DIR/scripts/local-tts-f5.mjs" \
  "$PI_USER@$PI_HOST:$PI_DIR/scripts/"

rsync -avz \
  -e "$RSYNC_SSH" \
  "$PROJECT_DIR/package.json" \
  "$PROJECT_DIR/package-lock.json" \
  "$PI_USER@$PI_HOST:$PI_DIR/"

# 不需要 npm install，依赖没变

# 4. 启动服务
echo "[4/4] 执行远端模式: $REMOTE_MODE..."
ssh "${SSH_OPTS[@]}" "$PI_USER@$PI_HOST" "cd $PI_DIR && chmod +x scripts/markradio.sh && bash scripts/markradio.sh $REMOTE_MODE"

echo ""
echo "========== 部署完成 =========="
