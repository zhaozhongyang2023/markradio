#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${MOODWAVE_CONFIG:-$HOME/.config/moodwave/config.env}"
PORT="${MOODWAVE_PORT:-${MOODWAVE_API_PORT:-38765}}"
WEB_PORT="${MOODWAVE_WEB_PORT:-38080}"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  PORT="${MOODWAVE_PORT:-${MOODWAVE_API_PORT:-$PORT}}"
  WEB_PORT="${MOODWAVE_WEB_PORT:-$WEB_PORT}"
fi

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "[ok] $1"
  else
    echo "[missing] $1"
  fi
}

echo "MoodWave Steam Deck doctor"
echo "Config: $CONFIG_FILE"
[[ -f "$CONFIG_FILE" ]] && echo "[ok] config exists" || echo "[missing] config"
[[ -f "$HOME/.config/systemd/user/moodwave.service" ]] && echo "[ok] systemd service file" || echo "[missing] systemd service file"
check_cmd curl
check_cmd git
check_cmd node
check_cmd npm
check_cmd systemctl

systemctl --user is-active moodwave.service >/dev/null 2>&1 && echo "[ok] service active" || echo "[warn] service not active"

if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo "[ok] API health http://127.0.0.1:$PORT/api/health"
else
  echo "[warn] API health failed http://127.0.0.1:$PORT/api/health"
fi

echo "Web: http://127.0.0.1:$WEB_PORT/?deck=1"
[[ -d "$HOME/homebrew/plugins/moodwave-deck-companion" ]] && echo "[ok] Decky plugin installed" || echo "[warn] Decky plugin not found"
