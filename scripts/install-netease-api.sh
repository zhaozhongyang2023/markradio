#!/usr/bin/env bash
##############################################
# MoodWave — 网易云音乐 API 一键安装
# 用法: bash install-netease-api.sh
# 跨平台：Steam Deck (SteamOS) / 树莓派 (Raspberry Pi OS) / 其他 Linux
##############################################
set -euo pipefail

INSTALL_DIR="${HOME}/netease-api"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
USE_SYSTEMD="${USE_SYSTEMD:-auto}"  # auto / 1 / 0

GREEN='\033[32m'
YELLOW='\033[33m'
CYAN='\033[36m'
RESET='\033[0m'

say()     { printf "${GREEN}[Netease]${RESET} %s\n" "$1"; }
warn()    { printf "${YELLOW}[!]${RESET} %s\n" "$1" >&2; }
ask()     { printf "${CYAN}[?]${RESET} %s" "$1"; }
done_msg(){ printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
oops()    { printf "${YELLOW}[✗]${RESET} %s\n" "$1" >&2; exit 1; }

# ── 检查 Node.js ──
if ! command -v node >/dev/null 2>&1; then
  oops "未找到 Node.js，请先安装：https://nodejs.org"
fi

NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  oops "Node.js 版本需 >= 18，当前: $(node --version)"
fi

say "Node.js $(node --version) ✓"

# ── 检测 systemd 可用性 ──
if [[ "$USE_SYSTEMD" = "auto" ]]; then
  if systemctl --user list-jobs >/dev/null 2>&1; then
    USE_SYSTEMD=1
  else
    USE_SYSTEMD=0
  fi
fi

# ── 已安装检查 ──
if [[ -f "${INSTALL_DIR}/run.js" ]] && [[ -d "${INSTALL_DIR}/node_modules" ]]; then
  say "网易云 API 已安装，跳过下载"
else
  say "安装网易云 API（NeteaseCloudMusicApi）..."

  mkdir -p "$INSTALL_DIR"

  # npm package.json
  cat > "${INSTALL_DIR}/package.json" <<'PJSON'
{"name":"netease-api-runner","private":true,"dependencies":{"NeteaseCloudMusicApi":"latest"}}
PJSON

  cd "$INSTALL_DIR"
  if npm install --silent 2>&1; then
    done_msg "依赖安装完成"
  else
    oops "npm install 失败，请检查网络或手动重试"
  fi

  # 启动脚本
  cat > "${INSTALL_DIR}/run.js" <<RUNJS
const { server } = require('NeteaseCloudMusicApi');
server.serveNcmApi({
  port: ${PORT},
  host: '${HOST}',
  checkVersion: false,
}).then(() => {
  console.log('Netease API started on port ${PORT}');
}).catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
RUNJS

  done_msg "安装完成"
fi

# ── 测试启动 ──
say "测试 API 启动..."

cd "$INSTALL_DIR"
node run.js &
API_PID=$!
sleep 3

if ss -tlnp 2>/dev/null | grep -q ":${PORT}"; then
  done_msg "API 在端口 ${PORT} 正常运行"
  # 测试接口
  if curl -fsS "http://${HOST}:${PORT}/login/qr/key" >/dev/null 2>&1; then
    done_msg "扫码登录接口测试通过 ✓"
  fi
  kill $API_PID 2>/dev/null || true
else
  warn "端口 ${PORT} 未监听，查看日志"
  kill $API_PID 2>/dev/null || true
fi

# ── systemd 服务 ──
if [[ "$USE_SYSTEMD" = "1" ]]; then
  say "创建 systemd 后台服务..."

  mkdir -p "${HOME}/.config/systemd/user"
  cat > "${HOME}/.config/systemd/user/netease-api.service" <<SYSEOF
[Unit]
Description=NeteaseCloudMusicApi
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(command -v node) run.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
SYSEOF

  systemctl --user daemon-reload
  systemctl --user enable netease-api.service
  systemctl --user start netease-api.service

  sleep 2
  if systemctl --user is-active netease-api.service >/dev/null 2>&1; then
    done_msg "systemd 服务已启动 ✓"
  else
    warn "服务未能自动启动，请执行: systemctl --user start netease-api.service"
  fi
else
  say "未检测到 systemd 用户会话，跳过服务创建"
  echo ""
  echo "  手动启动命令:"
  echo "    cd ${INSTALL_DIR} && node run.js &"
  echo ""
fi

# ── 完成 ──
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║    🎵 网易云 API 安装完成！        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  API 地址: http://${HOST}:${PORT}"
echo "  安装目录: ${INSTALL_DIR}"
echo ""
echo "  常用命令:"
echo "    启动:    systemctl --user start netease-api.service"
echo "    停止:    systemctl --user stop netease-api.service"
echo "    状态:    systemctl --user status netease-api.service"
echo "    手动:    cd ${INSTALL_DIR} && node run.js &"
