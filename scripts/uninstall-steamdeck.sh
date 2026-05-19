#!/usr/bin/env bash
set -euo pipefail

PREFIX="${PREFIX:-$HOME/.local/share/moodwave}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/moodwave}"
SERVICE_FILE="$HOME/.config/systemd/user/moodwave.service"
DESKTOP_FILE="$HOME/Desktop/MoodWave.desktop"
PLUGIN_DIR="$HOME/homebrew/plugins/moodwave-deck-companion"
NETEASE_DIR="$HOME/netease-api"
NETEASE_SERVICE="$HOME/.config/systemd/user/netease-api.service"
KEEP_CONFIG=""
NON_INTERACTIVE=0

usage() {
  cat <<'EOF'
MoodWave Steam Deck uninstaller

Usage:
  bash uninstall-steamdeck.sh [options]

Options:
  --prefix <path>       Default: ~/.local/share/moodwave
  --config-dir <path>   Default: ~/.config/moodwave
  --keep-config         Keep config files, including API keys
  --remove-config       Remove config files
  --non-interactive     Do not prompt; defaults to keeping config
  -h, --help            Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --config-dir) CONFIG_DIR="$2"; shift 2 ;;
    --keep-config) KEEP_CONFIG=1; shift ;;
    --remove-config) KEEP_CONFIG=0; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

ask_keep_config() {
  if [[ -n "$KEEP_CONFIG" ]]; then
    return
  fi
  if [[ "$NON_INTERACTIVE" = "1" ]]; then
    KEEP_CONFIG=1
    return
  fi
  local answer
  read -r -p "[MoodWave] 保留配置文件和 API Key，方便下次重装？[Y/n]: " answer
  case "$answer" in
    n|N|no|NO|No) KEEP_CONFIG=0 ;;
    *) KEEP_CONFIG=1 ;;
  esac
}

echo "[MoodWave] Stopping services"
systemctl --user disable --now moodwave.service 2>/dev/null || true
systemctl --user disable --now netease-api.service 2>/dev/null || true
rm -f "$SERVICE_FILE"
rm -f "$NETEASE_SERVICE"
systemctl --user daemon-reload 2>/dev/null || true

echo "[MoodWave] Removing desktop shortcut and Decky plugin"
rm -f "$DESKTOP_FILE"
rm -rf "$PLUGIN_DIR"

echo "[MoodWave] Removing application files"
rm -rf "$PREFIX"
rm -rf "$NETEASE_DIR"

ask_keep_config
if [[ "$KEEP_CONFIG" = "1" ]]; then
  cat <<EOF
[MoodWave] Uninstalled application files.
Config kept at: $CONFIG_DIR
Reinstall will reuse saved keys and settings.
EOF
else
  echo "[MoodWave] Removing config files"
  rm -rf "$CONFIG_DIR"
  echo "[MoodWave] Config removed."
fi
