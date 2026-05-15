#!/bin/bash
# 部署到树莓派 — 在树莓派同一局域网执行
# 用法: ./deploy.sh [pi_host]

set -e
PI_HOST="${1:-192.168.2.33}"
PI_USER="pi"
PI_DIR="/home/pi/markradio"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========== 部署 Mark Radio 到 $PI_USER@$PI_HOST =========="
echo ""

# 1. 构建前端
echo "[1/4] 构建前端..."
cd "$PROJECT_DIR"
npm run build --silent

# 2. 停止服务
echo "[2/4] 停止远端服务..."
ssh "$PI_USER@$PI_HOST" "cd $PI_DIR && bash scripts/markradio.sh stop" 2>/dev/null || echo "  (服务可能未运行)"

# 3. 同步文件
echo "[3/4] 同步文件..."
rsync -avz --delete \
  "$PROJECT_DIR/dist/" \
  "$PI_USER@$PI_HOST:$PI_DIR/dist/"

rsync -avz --delete \
  "$PROJECT_DIR/server/" \
  "$PI_USER@$PI_HOST:$PI_DIR/server/"

rsync -avz \
  "$PROJECT_DIR/scripts/markradio.sh" \
  "$PI_USER@$PI_HOST:$PI_DIR/scripts/"

rsync -avz \
  "$PROJECT_DIR/package.json" \
  "$PI_USER@$PI_HOST:$PI_DIR/"

# 不需要 npm install，依赖没变

# 4. 启动服务
echo "[4/4] 启动远端服务..."
ssh "$PI_USER@$PI_HOST" "cd $PI_DIR && chmod +x scripts/markradio.sh && bash scripts/markradio.sh start"

echo ""
echo "========== 部署完成 =========="
