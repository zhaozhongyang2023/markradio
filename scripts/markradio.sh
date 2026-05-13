#!/bin/bash
# markradio.sh - Mark Radio 服务管理脚本
# 用法: ./markradio.sh {start|stop|refresh}

set -e

MARKRADIO_DIR="$HOME/markradio"
NETEASE_DIR="$HOME/netease-cloud-music-api"

MARKRADIO_PID="$MARKRADIO_DIR/markradio.pid"
NETEASE_PID="$NETEASE_DIR/netease-api.pid"

MARKRADIO_LOG="$MARKRADIO_DIR/markradio.log"
NETEASE_LOG="$NETEASE_DIR/netease-api.log"

DISPLAY="${DISPLAY:-:0}"
KIOSK_URL="http://localhost:8080"

red()    { echo -e "\033[31m$1\033[0m"; }
green()  { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

status() {
  echo "====== Mark Radio 服务状态 ======"

  if pgrep -f "node server/index.js" > /dev/null 2>&1; then
    green "  Radio API  (8765)  ✓ 运行中"
  else
    red   "  Radio API  (8765)  ✗ 未启动"
  fi

  if pgrep -f "node index.js" | grep -v server > /dev/null 2>&1 || \
     ss -tlnp 2>/dev/null | grep -q ':3000'; then
    green "  Netease API (3000) ✓ 运行中"
  else
    red   "  Netease API (3000) ✗ 未启动"
  fi

  if pgrep -f "chromium.*kiosk" > /dev/null 2>&1; then
    green "  Chromium 全屏        ✓ 运行中"
  else
    red   "  Chromium 全屏        ✗ 未启动"
  fi
  echo "================================"
}

start_netease() {
  if ss -tlnp 2>/dev/null | grep -q ':3000'; then
    yellow "[skip] Netease API 已在运行 (端口 3000)"
    return
  fi

  echo -n "启动 Netease API..."
  cd "$NETEASE_DIR"
  nohup node index.js > "$NETEASE_LOG" 2>&1 &
  echo $! > "$NETEASE_PID"

  for i in $(seq 1 20); do
    sleep 0.5
    if ss -tlnp 2>/dev/null | grep -q ':3000'; then
      green " ✓ (PID $(cat $NETEASE_PID))"
      return
    fi
  done
  red " ✗ 启动超时，查看 $NETEASE_LOG"
}

start_radio() {
  if ss -tlnp 2>/dev/null | grep -q ':8765'; then
    yellow "[skip] Radio API 已在运行 (端口 8765)"
    return
  fi

  echo -n "启动 Radio API + Web 前端..."
  cd "$MARKRADIO_DIR"
  NODE_ENV=production nohup node server/index.js > "$MARKRADIO_LOG" 2>&1 &
  echo $! > "$MARKRADIO_PID"

  for i in $(seq 1 20); do
    sleep 0.5
    if ss -tlnp 2>/dev/null | grep -q ':8765'; then
      green " ✓ (PID $(cat $MARKRADIO_PID))"
      return
    fi
  done
  red " ✗ 启动超时，查看 $MARKRADIO_LOG"
}

start_chromium() {
  if pgrep -f "chromium.*kiosk" > /dev/null 2>&1; then
    yellow "[skip] Chromium 已在运行"
    return
  fi

  echo -n "启动 Chromium 全屏..."
  DISPLAY="$DISPLAY" nohup chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    "$KIOSK_URL" > /dev/null 2>&1 &
  sleep 2

  if pgrep -f "chromium.*kiosk" > /dev/null 2>&1; then
    green " ✓"
  else
    red " ✗ 未能启动"
  fi
}

start() {
  echo "========== 启动 Mark Radio =========="
  start_netease
  start_radio
  start_chromium
  echo
  status
}

stop_netease() {
  if [ -f "$NETEASE_PID" ]; then
    local pid=$(cat "$NETEASE_PID")
    if kill -0 "$pid" 2>/dev/null; then
      echo -n "停止 Netease API (PID $pid)..."
      kill "$pid" 2>/dev/null
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      green " ✓"
    fi
    rm -f "$NETEASE_PID"
  fi
  # 兜底
  pkill -f "node index.js" 2>/dev/null || true
}

stop_radio() {
  if [ -f "$MARKRADIO_PID" ]; then
    local pid=$(cat "$MARKRADIO_PID")
    if kill -0 "$pid" 2>/dev/null; then
      echo -n "停止 Radio API (PID $pid)..."
      kill "$pid" 2>/dev/null
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      green " ✓"
    fi
    rm -f "$MARKRADIO_PID"
  fi
  # 兜底
  pkill -f "node server/index.js" 2>/dev/null || true
}

stop_chromium() {
  echo -n "停止 Chromium..."
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  sleep 1
  green " ✓"
}

stop() {
  echo "========== 停止 Mark Radio =========="
  stop_chromium
  stop_radio
  stop_netease
  echo
  status
}

refresh() {
  echo "========== 刷新 Mark Radio =========="
  # 仅重启 Chromium 获取最新前端；后端不动
  stop_chromium
  start_chromium
  echo
  status
}

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  refresh)
    refresh
    ;;
  status)
    status
    ;;
  *)
    echo "用法: $0 {start|stop|refresh|status}"
    exit 1
    ;;
esac
