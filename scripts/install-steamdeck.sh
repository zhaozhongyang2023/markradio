#!/usr/bin/env bash
set -euo pipefail

APP_NAME="MoodWave"
DEFAULT_PREFIX="$HOME/.local/share/moodwave"
DEFAULT_CONFIG="$HOME/.config/moodwave/config.env"
DEFAULT_PORT="38765"
DEFAULT_WEB_PORT="38080"
DEFAULT_MUSIC_DIR="$HOME/Music"

PREFIX="$DEFAULT_PREFIX"
CONFIG_FILE="$DEFAULT_CONFIG"
PORT="$DEFAULT_PORT"
WEB_PORT="$DEFAULT_WEB_PORT"
PROVIDER="${AI_PROVIDER:-deepseek}"
API_BASE="${AI_BASE_URL:-}"
MODEL="${AI_MODEL:-}"
MUSIC_DIR="${MUSIC_DIR:-$DEFAULT_MUSIC_DIR}"
SKIP_PLUGIN=0
SKIP_DESKTOP=0
NON_INTERACTIVE=0
UNINSTALL_CONFIG_FLAG=""

usage() {
  cat <<'EOF'
MoodWave Steam Deck installer

Usage:
  bash install-steamdeck.sh [options]

Options:
  --prefix <path>                 Default: ~/.local/share/moodwave
  --config <path>                 Default: ~/.config/moodwave/config.env
  --port <port>                   Default: 38765
  --web-port <port>               Default: 38080
  --provider <name>               deepseek|openai|qwen|gemini|custom
  --api-base <url>                OpenAI-compatible API base URL
  --model <name>                  AI model name
  --music-dir <path>              Default: ~/Music
  --skip-plugin                   Do not deploy Decky plugin
  --skip-desktop-shortcut         Do not create desktop shortcut
  --keep-config                   Keep config when used with --uninstall
  --remove-config                 Remove config when used with --uninstall
  --non-interactive               Read values from env/args only
  --doctor                        Run doctor script if installed
  --uninstall                     Run uninstall script if installed
  -h, --help                      Show help

Environment:
  AI_API_KEY, AI_PROVIDER, AI_BASE_URL, AI_MODEL, MOODWAVE_REPO_URL
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --config) CONFIG_FILE="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --api-base) API_BASE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --music-dir) MUSIC_DIR="$2"; shift 2 ;;
    --skip-plugin) SKIP_PLUGIN=1; shift ;;
    --skip-desktop-shortcut) SKIP_DESKTOP=1; shift ;;
    --keep-config) UNINSTALL_CONFIG_FLAG="--keep-config"; shift ;;
    --remove-config) UNINSTALL_CONFIG_FLAG="--remove-config"; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    --doctor) exec bash "$PREFIX/scripts/doctor-steamdeck.sh" ;;
    --uninstall)
      uninstall_args=()
      [[ "${UNINSTALL_CONFIG_FLAG:-}" ]] && uninstall_args+=("$UNINSTALL_CONFIG_FLAG")
      [[ "$NON_INTERACTIVE" = "1" ]] && uninstall_args+=("--non-interactive")
      exec bash "$PREFIX/scripts/uninstall-steamdeck.sh" "${uninstall_args[@]}"
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

info() { printf '[MoodWave] %s\n' "$1"; }
fail() { printf '[MoodWave] ERROR: %s\n' "$1" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

prompt_value() {
  local var_name="$1"
  local prompt="$2"
  local default_value="${3:-}"
  local secret="${4:-0}"
  local current_value="${!var_name:-}"
  if [[ -n "$current_value" || "$NON_INTERACTIVE" = "1" ]]; then
    return
  fi
  if [[ "$secret" = "1" ]]; then
    read -r -s -p "$prompt" current_value
    printf '\n'
  else
    read -r -p "$prompt" current_value
  fi
  if [[ -z "$current_value" ]]; then
    current_value="$default_value"
  fi
  printf -v "$var_name" '%s' "$current_value"
}

default_ai_base() {
  case "$PROVIDER" in
    deepseek) echo "https://api.deepseek.com" ;;
    openai) echo "" ;;
    qwen) echo "https://dashscope.aliyuncs.com/compatible-mode/v1" ;;
    gemini) echo "https://generativelanguage.googleapis.com/v1beta/openai" ;;
    custom) echo "$API_BASE" ;;
    *) echo "$API_BASE" ;;
  esac
}

default_ai_model() {
  case "$PROVIDER" in
    deepseek) echo "deepseek-chat" ;;
    openai) echo "gpt-5.5" ;;
    qwen) echo "qwen-plus" ;;
    gemini) echo "gemini-2.5-flash" ;;
    custom) echo "$MODEL" ;;
    *) echo "$MODEL" ;;
  esac
}

detect_environment() {
  info "Checking Steam Deck / SteamOS environment"
  if [[ -r /etc/os-release ]] && grep -qi "steamos\\|steam deck" /etc/os-release; then
    return
  fi
  if [[ "${USER:-}" != "deck" ]]; then
    info "This does not look like the default Steam Deck user; continuing anyway."
  fi
}

install_source() {
  local script_dir source_dir tarball repo_url
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source_dir="$(cd "$script_dir/.." && pwd)"
  tarball="$script_dir/../moodwave-v5.tar.gz"
  repo_url="${MOODWAVE_REPO_URL:-}"

  mkdir -p "$PREFIX"
  if [[ -f "$source_dir/package.json" && -d "$source_dir/server" ]]; then
    info "Installing from local checkout"
    tar --exclude=node_modules --exclude=.git --exclude=data --exclude=dist -C "$source_dir" -cf - . | tar -C "$PREFIX" -xf -
  elif [[ -f "$tarball" ]]; then
    info "Installing from release tarball"
    tar -xzf "$tarball" -C "$PREFIX" --strip-components=1
  elif [[ -n "$repo_url" ]]; then
    info "Cloning MoodWave repository"
    rm -rf "$PREFIX.tmp"
    git clone --depth 1 "$repo_url" "$PREFIX.tmp"
    rm -rf "$PREFIX"
    mv "$PREFIX.tmp" "$PREFIX"
  else
    fail "No local checkout, release tarball, or MOODWAVE_REPO_URL found."
  fi
}

write_config() {
  local api_key="${AI_API_KEY:-}"
  API_BASE="${API_BASE:-$(default_ai_base)}"
  MODEL="${MODEL:-$(default_ai_model)}"

  if [[ "$NON_INTERACTIVE" = "0" ]]; then
    echo
    echo "Choose AI provider: deepseek | openai | qwen | gemini | custom"
  fi
  prompt_value PROVIDER "AI provider [$PROVIDER]: " "$PROVIDER"
  API_BASE="${API_BASE:-$(default_ai_base)}"
  MODEL="${MODEL:-$(default_ai_model)}"
  prompt_value API_BASE "AI base URL [$API_BASE]: " "$API_BASE"
  prompt_value MODEL "AI model [$MODEL]: " "$MODEL"
  prompt_value PORT "MoodWave API port [$PORT]: " "$PORT"
  prompt_value WEB_PORT "MoodWave Web port [$WEB_PORT]: " "$WEB_PORT"
  prompt_value MUSIC_DIR "Music directory [$MUSIC_DIR]: " "$MUSIC_DIR"
  prompt_value api_key "AI API Key: " "" 1
  [[ -n "$api_key" ]] || fail "AI_API_KEY is required for Steam Deck install."

  mkdir -p "$(dirname "$CONFIG_FILE")"
  umask 077
  cat > "$CONFIG_FILE" <<EOF
MOODWAVE_HOST=127.0.0.1
MOODWAVE_PORT=$PORT
MOODWAVE_WEB_PORT=$WEB_PORT
MOODWAVE_WEB_ORIGIN=http://127.0.0.1:$WEB_PORT
AI_PROVIDER=$PROVIDER
AI_BASE_URL=$API_BASE
AI_MODEL=$MODEL
AI_API_KEY=$api_key
MUSIC_DIR=$MUSIC_DIR
APP_MODE=steamdeck
ENABLE_TTS=true
ENABLE_WEATHER=true
ENABLE_HOLIDAY=true
ENABLE_LOCATION=true
EOF
  chmod 600 "$CONFIG_FILE"
  info "Wrote config to $CONFIG_FILE"
}

install_dependencies() {
  info "Installing Node dependencies and building Web/PWA"
  cd "$PREFIX"
  npm install
  npm run build
}

install_service() {
  local service_dir service_file
  service_dir="$HOME/.config/systemd/user"
  service_file="$service_dir/moodwave.service"
  mkdir -p "$service_dir" "$HOME/.local/state/moodwave/logs"
  cat > "$service_file" <<EOF
[Unit]
Description=MoodWave Local AI Radio Service
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$PREFIX
Environment=MOODWAVE_CONFIG=$CONFIG_FILE
EnvironmentFile=$CONFIG_FILE
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now moodwave.service
  info "Started systemd user service moodwave.service"
}

install_desktop_shortcut() {
  [[ "$SKIP_DESKTOP" = "1" ]] && return
  local desktop_file="$HOME/Desktop/MoodWave.desktop"
  mkdir -p "$HOME/Desktop"
  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=MoodWave
Comment=AI DJ Radio for Steam Deck
Exec=xdg-open http://127.0.0.1:$WEB_PORT/?deck=1
Icon=applications-multimedia
Terminal=false
Categories=Audio;Music;
EOF
  chmod +x "$desktop_file"
  info "Created desktop shortcut $desktop_file"
}

install_decky_plugin() {
  [[ "$SKIP_PLUGIN" = "1" ]] && return
  local plugin_src="$PREFIX/deck-companion"
  local plugin_root="$HOME/homebrew/plugins"
  local plugin_dest="$plugin_root/moodwave-deck-companion"
  if [[ ! -d "$plugin_src" ]]; then
    info "Deck Companion source not found; skipping plugin install."
    return
  fi
  if [[ -f "$plugin_src/package.json" ]]; then
    info "Building Deck Companion plugin"
    (cd "$plugin_src" && npm install && npm run build)
  fi
  if [[ ! -d "$plugin_root" ]]; then
    info "Decky plugin directory not found; install Decky Loader first or copy plugin zip manually."
    return
  fi
  rm -rf "$plugin_dest"
  mkdir -p "$plugin_dest"
  tar --exclude=node_modules -C "$plugin_src" -cf - . | tar -C "$plugin_dest" -xf -
  info "Installed Decky plugin to $plugin_dest"
}

health_check() {
  info "Waiting for MoodWave health check"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      info "MoodWave is ready: http://127.0.0.1:$WEB_PORT/?deck=1"
      return
    fi
    sleep 1
  done
  fail "Health check failed. Run: systemctl --user status moodwave.service"
}

detect_environment
need_cmd curl
need_cmd git
need_cmd node
need_cmd npm
need_cmd systemctl
install_source
write_config
install_dependencies
install_service
install_desktop_shortcut
install_decky_plugin
health_check
