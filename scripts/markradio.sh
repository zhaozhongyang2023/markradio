#!/bin/bash
# markradio.sh - MoodWave / Mark Radio 服务管理脚本
# 用法: ./markradio.sh {start|stop|refresh|status|server}

set -e


##############################################
# SSH / headless 检测
##############################################
is_headless() {
  # 检查 X11 是否实际在运行（而非仅靠 DISPLAY 环境变量）
  if pgrep -x Xorg >/dev/null 2>&1; then
    # X11 在运行，强制设置 DISPLAY
    [[ -z "${DISPLAY:-}" ]] && export DISPLAY=:0
    return 1
  fi
  if pgrep -x X >/dev/null 2>&1; then
    [[ -z "${DISPLAY:-}" ]] && export DISPLAY=:0
    return 1
  fi
  # Wayland 检测
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] || pgrep -x gamescope >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

has_display() {
  if is_headless; then
    yellow "[headless] 无显示器，跳过图形界面操作"
    return 1
  fi
  return 0
}

APP_NAME="${MOODWAVE_NAME:-MoodWave}"
MARKRADIO_DIR="${MOODWAVE_DIR:-${MARKRADIO_DIR:-$HOME/markradio}}"

# 自动检测 moodwave 安装路径（兼容树莓派 /home/pi/markradio 和 Steam Deck /home/deck/.local/share/moodwave）
if [ ! -d "$MARKRADIO_DIR" ] && [ -d "$HOME/.local/share/moodwave" ]; then
  MARKRADIO_DIR="$HOME/.local/share/moodwave"
fi
NETEASE_DIR="${NETEASE_DIR:-$HOME/netease-api}"
API_PORT="${MOODWAVE_API_PORT:-${MOODWAVE_PORT:-${MARKRADIO_API_PORT:-38765}}}"
WEB_PORT="${MOODWAVE_WEB_PORT:-${MARKRADIO_WEB_PORT:-38080}}"
NETEASE_PORT="${NETEASE_PORT:-3000}"
PLUGIN_PORT="${PLUGIN_PORT:-38766}"

MARKRADIO_PID="$MARKRADIO_DIR/markradio.pid"
NETEASE_PID="$NETEASE_DIR/netease-api.pid"

MARKRADIO_LOG="$MARKRADIO_DIR/markradio.log"
NETEASE_LOG="$NETEASE_DIR/netease-api.log"
PLUGIN_PID="$MARKRADIO_DIR/plugin-server.pid"
PLUGIN_LOG="$MARKRADIO_DIR/plugin-server.log"
FIREFOX_LOG="$MARKRADIO_DIR/firefox-kiosk.log"
FIREFOX_PROFILE="$MARKRADIO_DIR/firefox-kiosk-profile"

DISPLAY="${DISPLAY:-:0}"
KIOSK_URL="${KIOSK_URL:-http://localhost:${WEB_PORT}/?lowPower=1}"

red()    { echo -e "\033[31m$1\033[0m"; }
green()  { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

port_listening() {
  ss -tln 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${1}$"
}

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
  echo "====== $APP_NAME 服务状态 ======"

  if pgrep -f "node server/index.js" > /dev/null 2>&1; then
    green "  Radio API  ($API_PORT)  ✓ 运行中"
  else
    red   "  Radio API  ($API_PORT)  ✗ 未启动"
  fi

  if pgrep -f "node run.js" | grep -v server > /dev/null 2>&1 || \
     port_listening "$NETEASE_PORT"; then
    green "  Netease API ($NETEASE_PORT) ✓ 运行中"
  else
    red   "  Netease API ($NETEASE_PORT) ✗ 未启动"
  fi

  if port_listening "$PLUGIN_PORT"; then
    green "  Plugin API ($PLUGIN_PORT)  ✓ 运行中"
  else
    red   "  Plugin API ($PLUGIN_PORT)  ✗ 未启动"
  fi

  if pgrep -f "firefox.*--kiosk" > /dev/null 2>&1; then
    green "  Firefox 全屏        ✓ 运行中"
  else
    red   "  Firefox 全屏        ✗ 未启动"
  fi
  echo "================================"
}

start_netease() {
  if port_listening "$NETEASE_PORT"; then
    yellow "[skip] Netease API 已在运行 (端口 $NETEASE_PORT)"
    return
  fi

  echo -n "启动 Netease API..."
  cd "$NETEASE_DIR"
  PORT="$NETEASE_PORT" nohup node run.js > "$NETEASE_LOG" 2>&1 &
  echo $! > "$NETEASE_PID"

  for i in $(seq 1 20); do
    sleep 0.5
    if port_listening "$NETEASE_PORT"; then
      green " ✓ (PID $(cat $NETEASE_PID))"
      return
    fi
  done
  red " ✗ 启动超时，查看 $NETEASE_LOG"
}


start_plugin_server() {
  if port_listening "$PLUGIN_PORT"; then
    yellow "[skip] Plugin API 已在运行 (端口 $PLUGIN_PORT)"
    return
  fi

  local plugin_dir="$MARKRADIO_DIR/plugin-server"
  if [ ! -f "$plugin_dir/index.js" ]; then
    yellow "[skip] Plugin server 未安装 ($plugin_dir/index.js 不存在)"
    return
  fi

  echo -n "启动 Plugin API..."
  cd "$MARKRADIO_DIR"
  PLUGIN_API_PORT="$PLUGIN_PORT" nohup node plugin-server/index.js > "$PLUGIN_LOG" 2>&1 &
  echo $! > "$PLUGIN_PID"

  for i in $(seq 1 20); do
    sleep 0.5
    if port_listening "$PLUGIN_PORT"; then
      green " ✓ (PID $(cat $PLUGIN_PID))"
      return
    fi
  done
  red " ✗ 启动超时，查看 $PLUGIN_LOG"
}


start_radio() {
  if port_listening "$API_PORT"; then
    yellow "[skip] Radio API 已在运行 (端口 $API_PORT)"
    return
  fi

  echo -n "启动 Radio API + Web 前端..."
  cd "$MARKRADIO_DIR"
  NODE_ENV=production \
  MOODWAVE_API_PORT="$API_PORT" \
  MOODWAVE_PORT="$API_PORT" \
  MOODWAVE_WEB_PORT="$WEB_PORT" \
  MARKRADIO_API_PORT="$API_PORT" \
  MARKRADIO_WEB_PORT="$WEB_PORT" \
  nohup node server/index.js > "$MARKRADIO_LOG" 2>&1 &
  echo $! > "$MARKRADIO_PID"

  for i in $(seq 1 20); do
    sleep 0.5
    if port_listening "$API_PORT"; then
      green " ✓ (PID $(cat $MARKRADIO_PID))"
      return
    fi
  done
  red " ✗ 启动超时，查看 $MARKRADIO_LOG"
}

disable_screen_blank() {
  if is_headless; then return; fi
  export DISPLAY="${DISPLAY:-:0}"
  xset s off 2>/dev/null || true
  xset -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
}

enable_screen_blank() {
  if is_headless; then return; fi
  export DISPLAY="${DISPLAY:-:0}"
  # 服务端模式不占用本机屏幕，恢复 X11 屏保/DPMS，让树莓派屏幕可以熄屏节电。
  xset s on 2>/dev/null || true
  xset s blank 2>/dev/null || true
  xset s 600 600 2>/dev/null || true
  xset +dpms 2>/dev/null || true
  xset dpms 0 0 600 2>/dev/null || true
}

prepare_firefox_profile() {
  mkdir -p "$FIREFOX_PROFILE"
  cat > "$FIREFOX_PROFILE/user.js" <<'EOF'
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.sessionstore.max_tabs_undo", 0);
user_pref("browser.sessionstore.max_windows_undo", 0);
user_pref("browser.tabs.remote.autostart", false);
user_pref("dom.ipc.processCount", 1);
user_pref("dom.ipc.processCount.webIsolated", 1);
user_pref("fission.autostart", false);
user_pref("layout.frame_rate", 8);
user_pref("toolkit.cosmeticAnimations.enabled", false);
user_pref("ui.prefersReducedMotion", 1);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("app.update.enabled", false);
EOF
}

force_kiosk_fullscreen() {
  if is_headless; then return; fi
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
  if ! has_display; then
    yellow "[skip] 无显示器，跳过 Firefox"
    return
  fi
  local firefox_bin
  firefox_bin="$(command -v firefox-esr || command -v firefox || true)"
  if [ -z "$firefox_bin" ]; then
    red " ✗ 未安装 Firefox"
    return
  fi
  prepare_firefox_profile

  DISPLAY="$DISPLAY" nohup "$firefox_bin" \
    --profile "$FIREFOX_PROFILE" \
    --no-remote \
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
  echo "========== 启动 $APP_NAME =========="
  clear_cache
  start_netease
  start_plugin_server
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
  pkill -f "node run.js" 2>/dev/null || true
}


stop_plugin_server() {
  if [ -f "$PLUGIN_PID" ]; then
    local pid=$(cat "$PLUGIN_PID")
    if kill -0 "$pid" 2>/dev/null; then
      echo -n "停止 Plugin API (PID $pid)..."
      kill "$pid" 2>/dev/null
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      green " ✓"
    fi
    rm -f "$PLUGIN_PID"
  fi
  # 兜底
  pkill -f "node plugin-server/index.js" 2>/dev/null || true
}


stop_radio() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files markradio.service >/dev/null 2>&1; then
    sudo -n systemctl stop markradio.service 2>/dev/null || true
  fi
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files moodwave.service >/dev/null 2>&1; then
    sudo -n systemctl stop moodwave.service 2>/dev/null || true
  fi
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
  pkill -f "chromium.*--kiosk" 2>/dev/null || true
  pkill -f "chromium.*--app=$KIOSK_URL" 2>/dev/null || true
  sleep 1
  green " ✓"
}

stop() {
  echo "========== 停止 $APP_NAME =========="
  stop_chromium
  stop_plugin_server
  stop_radio
  stop_netease
  echo -n "清理音频进程..."
  pkill -9 -f ffplay 2>/dev/null || true
  pkill -9 -f ffmpeg 2>/dev/null || true
  green " ✓"
  echo
  status
}

refresh() {
  echo "========== 刷新 $APP_NAME =========="
  stop_chromium
  stop_plugin_server
  stop_radio
  echo -n "清理音频进程..."
  pkill -9 -f ffplay 2>/dev/null || true
  pkill -9 -f ffmpeg 2>/dev/null || true
  green " ✓"
  clear_cache
  start_netease
  start_plugin_server
  start_plugin_server
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

server() {
  echo "========== 启动 $APP_NAME (服务端模式) =========="
  clear_cache
  stop_chromium
  enable_screen_blank
  start_netease
  start_plugin_server
  start_plugin_server
  start_radio
  echo
  local local_ip
  local_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || ip -4 addr show scope global 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -1 || echo '127.0.0.1')"
  echo "后端服务已启动，浏览器访问 http://${local_ip}:$WEB_PORT"
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
  server)
    server
    ;;
  *)
    echo "用法: $0 {start|stop|refresh|status|server}"
    exit 1
    ;;
esac
