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
FIREFOX_LOG="$MARKRADIO_DIR/firefox-kiosk.log"

DISPLAY="${DISPLAY:-:0}"
KIOSK_URL="http://localhost:8080"

red()    { echo -e "\033[31m$1\033[0m"; }
green()  { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

clear_cache() {
  echo -n "清理缓存..."
  rm -rf "$MARKRADIO_DIR/data/cache/tts"/* 2>/dev/null || true
  # 只清除 TTS/播放记录/当前计划，保留网易云登录、口味、声线等配置
  if [ -f "$MARKRADIO_DIR/data/markradio.db" ]; then
    sqlite3 "$MARKRADIO_DIR/data/markradio.db" "
      DELETE FROM tts_cache;
      DELETE FROM plays;
      DELETE FROM kv WHERE key='planToday';
      DELETE FROM kv WHERE key='now';
      DELETE FROM kv WHERE key='tracks';
    " 2>/dev/null || true
  fi
  green " ✓"
}

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

  if pgrep -f "firefox.*--kiosk" > /dev/null 2>&1; then
    green "  Firefox 全屏        ✓ 运行中"
  else
    red   "  Firefox 全屏        ✗ 未启动"
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

disable_screen_blank() {
  export DISPLAY="${DISPLAY:-:0}"
  xset s off 2>/dev/null || true
  xset -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
}

force_kiosk_fullscreen() {
  command -v xdotool >/dev/null 2>&1 || return
  command -v xdpyinfo >/dev/null 2>&1 || return

  local size width height windows
  size="$(DISPLAY="$DISPLAY" xdpyinfo 2>/dev/null | awk '/dimensions:/ {print $2; exit}')"
  width="${size%x*}"
  height="${size#*x}"
  if [ -z "$width" ] || [ -z "$height" ] || [ "$width" = "$size" ]; then
    return
  fi

  for i in $(seq 1 12); do
    windows="$(DISPLAY="$DISPLAY" xdotool search --onlyvisible --class firefox 2>/dev/null || true)"
    [ -n "$windows" ] && break
    sleep 1
  done
  [ -n "$windows" ] || return

  for i in $(seq 1 5); do
    for window in $windows; do
      DISPLAY="$DISPLAY" xdotool windowmove "$window" 0 0 2>/dev/null || true
      DISPLAY="$DISPLAY" xdotool windowsize "$window" "$width" "$height" 2>/dev/null || true
    done
    sleep 1
  done
}

start_chromium() {
  if pgrep -f "firefox.*--kiosk" > /dev/null 2>&1; then
    yellow "[skip] Firefox 已在运行"
    force_kiosk_fullscreen
    return
  fi

  echo -n "启动 Firefox 全屏..."
  local firefox_bin
  firefox_bin="$(command -v firefox-esr || command -v firefox || true)"
  if [ -z "$firefox_bin" ]; then
    red " ✗ 未安装 Firefox"
    return
  fi

  DISPLAY="$DISPLAY" nohup "$firefox_bin" \
    --new-instance \
    --kiosk \
    "$KIOSK_URL" > "$FIREFOX_LOG" 2>&1 &

  for i in $(seq 1 10); do
    sleep 1
    if pgrep -f "firefox.*--kiosk" > /dev/null 2>&1; then
      force_kiosk_fullscreen
      green " ✓"
      return
    fi
  done
  red " ✗ 未能启动，查看 $FIREFOX_LOG"
}

start() {
  echo "========== 启动 Mark Radio =========="
  clear_cache
  start_netease
  start_radio
  disable_screen_blank
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
  echo -n "停止 Firefox..."
  pkill -f "firefox.*--kiosk" 2>/dev/null || true
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
  stop_chromium
  stop_radio
  clear_cache
  start_netease
  start_radio
  # 等待服务器 warmup 完成，确保计划已就绪
  echo -n "等待服务就绪..."
  sleep 5
  green " ✓"
  disable_screen_blank
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
