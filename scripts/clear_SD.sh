#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║       十三哥 Steam Deck 空间清道夫 v2 — 通用版               ║
# ║       安全清理缓存 · 守护游戏存档 · 释放宝贵空间              ║
# ╚══════════════════════════════════════════════════════════════╝

# -e: 命令失败立即退出; -o pipefail: 管道中任一失败即失败
# 不启用 -u，避免未初始化变量导致异常退出
set -eo pipefail

HOME_DIR="${CLEAR_SD_HOME:-$HOME}"
STEAM_DIR="${CLEAR_SD_STEAM_DIR:-$HOME_DIR/.local/share/Steam}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

BEFORE_TOTAL_KB=0
BEFORE_USED_KB=0
BEFORE_AVAIL_KB=0
BEFORE_PCT=""
AFTER_AVAIL_KB=0

ITEM_IDS=(
  "trash"
  "thumbnails"
  "steam_logs"
  "shadercache"
  "browser_cache"
  "flatpak_cache"
  "package_cache"
  "temp_cache"
  "pnpm_store"
  "orphaned_compatdata"
  "homebrew_cache"
  "proton_old"
)

ITEM_NAMES=(
  "系统回收站"
  "图片缩略图缓存"
  "Steam 日志文件"
  "Steam 着色器缓存"
  "浏览器缓存"
  "Flatpak 软件缓存"
  "pip/npm 工具缓存"
  "临时缓存文件"
  "pnpm 全局包缓存"
  "孤立 Proton 兼容数据"
  "Homebrew 下载缓存"
  "老旧 Proton 版本"
)

ITEM_TAGS=(
  "🟢" "🟢" "🟢" "🟢" "🟢" "🟢" "🟢" "🟢"
  "🟢" "🟡" "🟢" "🟠"
)

ITEM_DESC=(
  "删除已经放进回收站的文件，不碰正常文件。"
  "删除系统自动生成的小图片缓存，需要时会自动重建。"
  "删除 Steam 运行日志，不影响游戏和存档。"
  "删除游戏渲染缓存，不删存档；部分游戏首次启动可能重新生成缓存。"
  "删除浏览器临时缓存，不删除书签、密码和下载文件。"
  "只删除 Flatpak 应用的 cache 目录，不删除应用数据。"
  "删除 pip/npm 等工具缓存，不删除项目文件。"
  "删除明确位于用户目录下的临时缓存。"
  "清理 pnpm 全局包存储，下次 pnpm install 自动重建。"
  "检测已卸载游戏残留的 Proton 运行时（保留 users/ 存档目录）。"
  "清理 Homebrew 下载的 formula 缓存包，不影响已安装软件。"
  "列出除最新版外的所有 Proton，手动选择删除哪些旧版本。"
)

ITEM_SIZES=()
ORPHAN_DETAILS=""   # 孤儿 compatdata 明细（用于报告）

# ──────────────────────────────────────────────
#  工具函数
# ──────────────────────────────────────────────

line() {
  printf '%s\n' '────────────────────────────────────────────────────────────'
}

thick_line() {
  printf '%s\n' '════════════════════════════════════════════════════════════════'
}

pause() {
  printf '\n按回车继续...'
  IFS= read -r _
}

box_text() {
  local text="$1" color="${2:-$BOLD}"
  printf '%b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%b\n' "$color" "$NC"
  printf '%b  %s%b\n' "$color" "$text" "$NC"
  printf '%b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%b\n' "$color" "$NC"
}

bytes_from_kb() {
  printf '%s\n' "$(( ${1:-0} * 1024 ))"
}

format_size() {
  local bytes="${1:-0}"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --format="%.1f" --suffix=B "$bytes" 2>/dev/null || printf '%sB' "$bytes"
  else
    awk -v b="$bytes" 'BEGIN {
      split("B KB MB GB TB", u, " ");
      i = 1;
      while (b >= 1024 && i < 5) { b = b / 1024; i++ }
      if (i == 1) printf "%d%s", b, u[i]; else printf "%.1f%s", b, u[i]
    }'
  fi
}

path_size() {
  local path="$1"
  [ -e "$path" ] || { printf '0\n'; return; }
  if du -sk "$path" >/dev/null 2>&1; then
    du -sk "$path" 2>/dev/null | awk '{sum += $1} END {print sum + 0}'
  else
    printf '0\n'
  fi
}

sum_patterns() {
  local total=0
  local pattern path
  for pattern in "$@"; do
    while IFS= read -r -d '' path; do
      total=$((total + $(path_size "$path")))
    done < <(find_matching_paths "$pattern")
  done
  printf '%s\n' "$total"
}

find_matching_paths() {
  local pattern="$1"
  local path
  if [[ "$pattern" == *'*'* ]]; then
    while IFS= read -r path; do
      [ -e "$path" ] && printf '%s\0' "$path"
    done < <(compgen -G "$pattern" 2>/dev/null)
  else
    [ -e "$pattern" ] && printf '%s\0' "$pattern"
  fi
}

is_under_home() {
  local path="$1"
  # 解析软链接后再判断真实路径
  local real_path
  real_path=$(readlink -f "$path" 2>/dev/null) || real_path="$path"
  case "$real_path" in
    "$HOME_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

safe_clear_path() {
  local path="$1"
  local real_path

  [ -e "$path" ] || return 0

  # 解析软链接，获取真实路径用于安全检查
  real_path=$(readlink -f "$path" 2>/dev/null) || real_path="$path"

  if ! is_under_home "$real_path"; then
    printf '  ⚠ 跳过：%s 不在用户目录内，为了安全不清理。
' "$path"
    return 0
  fi

  # 若 path 是软链接且目标不存在（损坏的链接），只删除链接本身
  if [ -L "$path" ] && [ ! -e "$path" ]; then
    rm -f -- "$path" 2>/dev/null
    printf '  ✓ 已移除损坏的软链接：%s
' "$path"
    return 0
  fi

  if [ -d "$path" ]; then
    # 只删除文件和空目录，保留非空子目录骨架（如 Steam shadercache 的 downloads/）
    find -L "$path" -mindepth 1 -type f -delete 2>/dev/null
    find -L "$path" -mindepth 1 -type d -empty -delete 2>/dev/null
  else
    rm -f -- "$path" 2>/dev/null
  fi
}

clear_patterns() {
  local pattern path
  for pattern in "$@"; do
    while IFS= read -r -d '' path; do
      safe_clear_path "$path"
    done < <(find_matching_paths "$pattern")
  done
}

# ──────────────────────────────────────────────

get_manifest_ids() {
  local lib=""
  local appid
  local vdf_path line

  for vdf_path in "$HOME_DIR/.local/share/Steam/steamapps/libraryfolders.vdf"                    "$HOME_DIR/.local/share/Steam/config/libraryfolders.vdf"; do
    [ -f "$vdf_path" ] || continue
    lib=""
    while IFS= read -r line; do
      if [[ "$line" =~ "path" ]]; then
        lib=$(echo "$line" | sed 's/.*"path"[[:space:]]*"\(.*\)"/\1/')
        continue
      fi
      if [[ "$line" =~ ^[[:space:]]*"([0-9]+)" ]]; then
        appid="${BASH_REMATCH[1]}"
        if [ -n "$lib" ] && [ -f "${lib}/steamapps/appmanifest_${appid}.acf" ]; then
          printf '%s\n' "$appid"
        fi
      fi
    done < "$vdf_path"
  done
}

#  新增：孤儿 compatdata 智能检测
# ──────────────────────────────────────────────

detect_orphaned_compatdata() {
  local compat_dir="$STEAM_DIR/steamapps/compatdata"
  [ -d "$compat_dir" ] || return 0

  local all_manifests=()
  local id
  while IFS= read -r id; do
    [ -n "$id" ] && all_manifests+=("$id")
  done < <(get_manifest_ids)

  # 检查 compatdata 中的每个目录
  ORPHAN_DETAILS=""
  for id_dir in "$compat_dir"/*/; do
    [ -d "$id_dir" ] || continue
    id=$(basename "$id_dir")

    # 跳过 Proton 全局容器
    [ "$id" = "0" ] && continue

    local found=0
    for m in "${all_manifests[@]}"; do
      [ "$m" = "$id" ] && { found=1; break; }
    done

    if [ "$found" -eq 0 ]; then
      local usr_size=$(path_size "$id_dir/pfx/drive_c/users")
      local total_size=$(path_size "$id_dir")
      local cleanable=$((total_size - usr_size))
      ORPHAN_DETAILS+="$(printf '  AppID %-10s ｜ 总量 %10s ｜ 可回收 %10s ｜ 存档保留 %s\n' \
        "$id" \
        "$(format_size "$(bytes_from_kb "$total_size")")" \
        "$(format_size "$(bytes_from_kb "$cleanable")")" \
        "$(format_size "$(bytes_from_kb "$usr_size")")")"$'\n'
    fi
  done
}

orphaned_compatdata_total_kb() {
  local compat_dir="$STEAM_DIR/steamapps/compatdata"
  [ -d "$compat_dir" ] || { printf '0\n'; return; }

  local all_manifests=()
  local id
  while IFS= read -r id; do
    [ -n "$id" ] && all_manifests+=("$id")
  done < <(get_manifest_ids)

  local total=0
  for id_dir in "$compat_dir"/*/; do
    [ -d "$id_dir" ] || continue
    id=$(basename "$id_dir")
    [ "$id" = "0" ] && continue

    local found=0
    for m in "${all_manifests[@]}"; do
      [ "$m" = "$id" ] && { found=1; break; }
    done
    if [ "$found" -eq 0 ]; then
      local usr_size=$(path_size "$id_dir/pfx/drive_c/users")
      local total_size=$(path_size "$id_dir")
      total=$((total + total_size - usr_size))
    fi
  done
  printf '%s\n' "$total"
}

# ──────────────────────────────────────────────
#  清理策略定义
# ──────────────────────────────────────────────

item_patterns() {
  case "$1" in
    trash)
      printf '%s\n' \
        "$HOME_DIR/.local/share/Trash/files" \
        "$HOME_DIR/.local/share/Trash/info"
      ;;
    thumbnails)
      printf '%s\n' "$HOME_DIR/.cache/thumbnails"
      ;;
    steam_logs)
      printf '%s\n' \
        "$STEAM_DIR/logs" \
        "$STEAM_DIR/controller_base/logs" \
        "$HOME_DIR/.steam/steam/logs"
      ;;
    shadercache)
      printf '%s\n' "$STEAM_DIR/steamapps/shadercache"
      ;;
    browser_cache)
      printf '%s\n' \
        "$HOME_DIR/.cache/mozilla" \
        "$HOME_DIR/.cache/chromium" \
        "$HOME_DIR/.cache/google-chrome" \
        "$HOME_DIR/.cache/Microsoft/Edge"
      ;;
    flatpak_cache)
      printf '%s\n' \
        "$HOME_DIR/.var/app/*/cache" \
        "$HOME_DIR/.cache/flatpak"
      ;;
    package_cache)
      printf '%s\n' \
        "$HOME_DIR/.cache/pip" \
        "$HOME_DIR/.cache/npm" \
        "$HOME_DIR/.npm/_cacache" \
        "$HOME_DIR/.cache/yay" \
        "$HOME_DIR/.cache/pacman"
      ;;
    temp_cache)
      printf '%s\n' \
        "$HOME_DIR/.cache/tmp" \
        "$HOME_DIR/.cache/temp" \
        "$HOME_DIR/.local/share/Steam/ubuntu12_32/steam-runtime/tmp"
      ;;
    pnpm_store)
      printf '%s\n' "$HOME_DIR/.local/share/pnpm/store"
      ;;
    orphaned_compatdata)
      printf '%s\n' "FN:clean_orphaned_compatdata"
      ;;
    homebrew_cache)
      printf '%s\n' "$HOME_DIR/.cache/Homebrew/downloads"
      ;;
    proton_old)
      printf '%s\n' "FN:clean_old_proton"
      ;;
  esac
}

# ──────────────────────────────────────────────
#  新增：存档安全的 compatdata 清理
# ──────────────────────────────────────────────

clean_orphaned_compatdata() {
  local compat_dir="$STEAM_DIR/steamapps/compatdata"
  [ -d "$compat_dir" ] || return

  local all_manifests=()
  local id
  while IFS= read -r id; do
    [ -n "$id" ] && all_manifests+=("$id")
  done < <(get_manifest_ids)

  for id_dir in "$compat_dir"/*/; do
    [ -d "$id_dir" ] || continue
    id=$(basename "$id_dir")
    [ "$id" = "0" ] && continue

    local found=0
    for m in "${all_manifests[@]}"; do
      [ "$m" = "$id" ] && { found=1; break; }
    done

    if [ "$found" -eq 0 ]; then
      local pfx_dir="$id_dir/pfx"
      if [ -d "$pfx_dir/drive_c/users" ]; then
        local before_kb=$(path_size "$id_dir")
        # 保留 users/ 目录，删除其余 Proton 运行时文件
        find "$pfx_dir" -mindepth 1 -maxdepth 1 -not -name 'drive_c' -exec rm -rf -- {} + 2>/dev/null
        if [ -d "$pfx_dir/drive_c" ]; then
          find "$pfx_dir/drive_c" -mindepth 1 -maxdepth 1 -not -name 'users' -exec rm -rf -- {} + 2>/dev/null
        fi
        local after_kb=$(path_size "$id_dir")
        local freed=$((before_kb - after_kb))
        printf '  ✓ AppID %s：释放 %s，存档保留 (%s)\n' \
          "$id" "$(format_size "$(bytes_from_kb "$freed")")" \
          "$(format_size "$(bytes_from_kb "$after_kb")")"
      else
        # 无 users 目录，直接全删
        rm -rf "$id_dir"
        printf '  ✓ AppID %s：已完全移除（无存档数据）\n' "$id"
      fi
    fi
  done
}

# ──────────────────────────────────────────────
#  新增：老旧 Proton 清理
# ──────────────────────────────────────────────

clean_old_proton() {
  local common_dir="$STEAM_DIR/steamapps/common"
  [ -d "$common_dir" ] || return

  printf '%b发现以下 Proton 版本：%b
' "$CYAN" "$NC"
  local versions=()
  local ver
  for ver_dir in "$common_dir"/Proton*; do
    [ -d "$ver_dir" ] || continue
    ver=$(basename "$ver_dir")
    versions+=("$ver")
    printf '  %s  %s  (%s)
'       "$([ "$ver" = "Proton - Experimental" ] && printf '⭐' || printf '  ')"       "$ver" "$(format_size "$(bytes_from_kb "$(path_size "$ver_dir")")")"
  done

  if [ "${#versions[@]}" -le 1 ]; then
    printf '
  ℹ 只有一个 Proton 版本，无需清理。
'
    return
  fi

  # 按版本号找最新：Proton 7.0 -> 700, Proton 9.0 -> 900，取最大值
  local latest_ver=""
  local latest_num=0
  local v v_num
  for v in "${versions[@]}"; do
    [[ "$v" == "Proton - Experimental" ]] && continue
    if [[ "$v" =~ Proton[[:space:]]+([0-9]+)\.([0-9]+) ]]; then
      v_num=$((BASH_REMATCH[1] * 100 + BASH_REMATCH[2]))
      if [ "$v_num" -gt "$latest_num" ]; then
        latest_num=$v_num
        latest_ver="$v"
      fi
    fi
  done

  if [ -z "$latest_ver" ]; then
    printf '
  ℹ 未找到可比较的 Proton 版本号，跳过清理。
'
    return
  fi

  printf '
%b建议保留 Experimental + %s（最新），删除其余旧版本。%b
' "$YELLOW" "$latest_ver" "$NC"
  printf '是否继续清理旧 Proton 版本？输入 1 确认，其他取消：'
  local answer
  IFS= read -r answer
  if [ "$answer" != "1" ]; then
    printf '  已取消。
'
    return
  fi

  local deleted=0
  for ver_dir in "$common_dir"/Proton*; do
    [ -d "$ver_dir" ] || continue
    ver=$(basename "$ver_dir")
    [ "$ver" = "Proton - Experimental" ] && continue
    if [ "$ver" = "$latest_ver" ]; then
      printf '  🛡 保留：%s
' "$ver"
      continue
    fi
    printf '  🗑 删除：%s (%s)
' "$ver" "$(format_size "$(bytes_from_kb "$(path_size "$ver_dir")")")"
    rm -rf "$ver_dir"
    deleted=1
  done
  [ "$deleted" -eq 0 ] && printf '  ℹ 没有可清理的旧版本。
'
}


# ──────────────────────────────────────────────
#  扫描 / 清理 引擎
# ──────────────────────────────────────────────

scan_items() {
  local id patterns size
  ITEM_SIZES=()

  # 先做一次孤儿检测
  detect_orphaned_compatdata

  for id in "${ITEM_IDS[@]}"; do
    case "$id" in
      orphaned_compatdata)
        size=$(orphaned_compatdata_total_kb)
        ;;
      proton_old)
        size=$(proton_old_size_kb)
        ;;
      *)
        patterns=()
        while IFS= read -r pattern; do
          patterns+=("$pattern")
        done < <(item_patterns "$id")
        size=$(sum_patterns "${patterns[@]}")
        ;;
    esac
    ITEM_SIZES+=("$size")
  done
}

proton_old_size_kb() {
  local common_dir="$STEAM_DIR/steamapps/common"
  [ -d "$common_dir" ] || { printf '0
'; return; }

  # 找最新版号
  local latest_ver=""
  local latest_num=0
  local v v_num ver_dir
  for ver_dir in "$common_dir"/Proton*; do
    [ -d "$ver_dir" ] || continue
    v=$(basename "$ver_dir")
    [[ "$v" == "Proton - Experimental" ]] && continue
    if [[ "$v" =~ Proton[[:space:]]+([0-9]+)\.([0-9]+) ]]; then
      v_num=$((BASH_REMATCH[1] * 100 + BASH_REMATCH[2]))
      if [ "$v_num" -gt "$latest_num" ]; then
        latest_num=$v_num
        latest_ver="$v"
      fi
    fi
  done

  local total=0
  for ver_dir in "$common_dir"/Proton*; do
    [ -d "$ver_dir" ] || continue
    v=$(basename "$ver_dir")
    [ "$v" = "Proton - Experimental" ] && continue
    [ "$v" = "$latest_ver" ] && continue
    total=$((total + $(path_size "$ver_dir")))
  done
  printf '%s
' "$total"
}


disk_line_for() {
  local target="$1"
  df -Pk "$target" 2>/dev/null | awk 'NR==2 {print $2, $3, $4, $5, $6}'
}

bar_for_percent() {
  local percent="$1"
  local filled=$((percent / 5))
  local empty=$((20 - filled))
  local bar=""
  local i
  for ((i = 0; i < filled; i++)); do bar="${bar}█"; done
  for ((i = 0; i < empty; i++)); do bar="${bar}░"; done
  printf '%s' "$bar"
}

status_name() {
  local percent="$1"
  if ((percent >= 90)); then
    printf '🔴 告急'
  elif ((percent >= 80)); then
    printf '🟡 紧张'
  else
    printf '🟢 正常'
  fi
}

status_color() {
  local percent="$1"
  if ((percent >= 90)); then
    printf '%b' "$RED"
  elif ((percent >= 80)); then
    printf '%b' "$YELLOW"
  else
    printf '%b' "$GREEN"
  fi
}

show_disk_report() {
  local total used avail pct mount color bar
  read -r total used avail pct mount < <(disk_line_for "$HOME_DIR")
  pct="${pct%%%}"
  BEFORE_AVAIL_KB="${BEFORE_AVAIL_KB:-$avail}"
  color="$(status_color "$pct")"
  bar="$(bar_for_percent "$pct")"

  printf '\n%b' "$BOLD"
  box_text "🩺 Steam Deck 存储体检"
  printf '%b\n' "$NC"
  printf '  📍 检测位置  %s\n' "$mount"
  printf '  💾 总容量    %s\n' "$(format_size "$(bytes_from_kb "$total")")"
  printf '  📦 已使用    %s\n' "$(format_size "$(bytes_from_kb "$used")")"
  printf '  🆓 剩余空间  %b%s%b\n' "$color" "$(format_size "$(bytes_from_kb "$avail")")" "$NC"
  printf '  📊 使用率    %b%s%% [%s] %s%b\n' "$color" "$pct" "$bar" "$(status_name "$pct")" "$NC"
}

show_sd_cards() {
  local found=0
  local path total used avail pct mount
  for path in /run/media/mmcblk0p1 /run/media/deck/*; do
    [ -e "$path" ] || continue
    mountpoint -q "$path" 2>/dev/null || continue
    read -r total used avail pct mount < <(disk_line_for "$path" 2>/dev/null) || continue
    [ -n "$total" ] || continue
    if [ "$found" -eq 0 ]; then
      printf '\n%b💳 外置存储%b\n' "$CYAN" "$NC"
    fi
    found=1
    printf '  %s ｜ %s 已用 / %s 总量 (%s%%)\n' \
      "$(basename "$path")" \
      "$(format_size "$(bytes_from_kb "$used")")" \
      "$(format_size "$(bytes_from_kb "$total")")" \
      "${pct%%%}"
  done
}

total_for_indexes() {
  local total=0 index
  for index in "$@"; do
    total=$((total + ${ITEM_SIZES[$index]:-0}))
  done
  printf '%s\n' "$total"
}

show_item_table() {
  local i size
  printf '\n%b📋 清理项目清单%b\n' "$BOLD" "$NC"
  line
  printf '%-4s %-22s %10s  %s\n' '序号' '项目' '可释放' '说明'
  line
  for i in "${!ITEM_IDS[@]}"; do
    size="${ITEM_SIZES[$i]:-0}"
    printf '%b %-2d %-20s %10s  %s\n' \
      "${ITEM_TAGS[$i]}" \
      "$((i + 1))" \
      "${ITEM_NAMES[$i]}" \
      "$(format_size "$(bytes_from_kb "$size")")" \
      "${ITEM_DESC[$i]}"
  done
  line

  # 孤儿 compatdata 明细
  if [ -n "$ORPHAN_DETAILS" ]; then
    printf '\n%b🔍 孤立 Proton 兼容数据明细：%b\n' "$MAGENTA" "$NC"
    printf '%s' "$ORPHAN_DETAILS"
    printf '  🛡 清理策略：保留 users/ 存档目录，仅删除 Proton 系统文件\n'
  fi
}

# ──────────────────────────────────────────────
#  清理执行
# ──────────────────────────────────────────────

clean_item() {
  local index="$1"
  local id="${ITEM_IDS[$index]}"
  local patterns pattern

  printf '
%b▸ 正在清理：%s%b
' "$CYAN" "${ITEM_NAMES[$index]}" "$NC"

  case "$id" in
    orphaned_compatdata)
      clean_orphaned_compatdata
      ;;
    proton_old)
      clean_old_proton
      ;;
    pnpm_store)
      if command -v pnpm >/dev/null 2>&1; then
        pnpm store prune --force >/dev/null 2>&1 && printf '  ✓ pnpm store 清理完成
' || printf '  ⚠ pnpm store 清理失败
'
      else
        if [ -d "$HOME_DIR/.local/share/pnpm/store" ]; then
          clear_patterns "$HOME_DIR/.local/share/pnpm/store"
          printf '  ✓ pnpm 缓存目录已清理
'
        else
          printf '  ℹ pnpm 缓存目录不存在，跳过
'
        fi
      fi
      ;;
    homebrew_cache)
      if command -v brew >/dev/null 2>&1; then
        brew cleanup -s >/dev/null 2>&1 && printf '  ✓ Homebrew 缓存清理完成
' || printf '  ⚠ Homebrew 清理失败
'
      else
        if [ -d "$HOME_DIR/.cache/Homebrew/downloads" ]; then
          clear_patterns "$HOME_DIR/.cache/Homebrew/downloads"
          printf '  ✓ Homebrew 下载缓存已清理
'
        else
          printf '  ℹ Homebrew 缓存目录不存在，跳过
'
        fi
      fi
      ;;
    *)
      patterns=()
      while IFS= read -r pattern; do
        patterns+=("$pattern")
      done < <(item_patterns "$id")
      clear_patterns "${patterns[@]}"
      ;;
  esac
}


clean_indexes() {
  local index
  for index in "$@"; do
    clean_item "$index"
  done
}

confirm_clean() {
  local answer
  printf '\n%b请输入 1 开始清理，输入其他内容返回菜单：%b' "$YELLOW" "$NC"
  IFS= read -r answer
  [ "$answer" = "1" ]
}

show_plan() {
  local title="$1"
  shift
  local total
  total="$(total_for_indexes "$@")"
  line
  printf '%b%s%b\n' "$BOLD" "$title" "$NC"
  printf '  📦 预计可释放：%b%s%b\n' "$GREEN" "$(format_size "$(bytes_from_kb "$total")")" "$NC"
  printf '  📋 会清理：'
  local first=1 index
  for index in "$@"; do
    [ "$first" -eq 0 ] && printf '、'
    printf '%s' "${ITEM_NAMES[$index]}"
    first=0
  done
  printf '\n'
  printf '  🛡 不会清理：游戏存档、已安装游戏、Proton 全局运行时(compatdata/0)\n'
  printf '  🛡 不会清理：Steam Linux Runtimes、Flatpak 应用数据、Downloads\n'
}

main_menu() {
  local choice
  while true; do
    line
    printf '%b\n' "${BOLD}请选择清理方式${NC}"
    printf '  %b1.%b  🟢 一键推荐（9项）— 安全省心，涵盖日常缓存 + pnpm + 孤立 compatdata\n' "$BOLD" "$NC"
    printf '  %b2.%b  🔥 深度释放（12项）— 全部项目，含老旧 Proton 版本清理\n' "$BOLD" "$NC"
    printf '  %b3.%b  📋 自选清理 — 逐项确认，每项显示大小和风险\n' "$BOLD" "$NC"
    printf '  %b4.%b  🚪 退出，不清理\n' "$BOLD" "$NC"
    printf '请输入数字 1/2/3/4：'
    IFS= read -r choice

    case "$choice" in
      1)
        show_plan "🟢 一键推荐清理" 0 1 2 3 4 5 6 7 8 9
        confirm_clean && { clean_indexes 0 1 2 3 4 5 6 7 8 9; return; }
        ;;
      2)
        show_plan "🔥 深度释放空间" 0 1 2 3 4 5 6 7 8 9 10 11
        confirm_clean && { clean_indexes 0 1 2 3 4 5 6 7 8 9 10 11; return; }
        ;;
      3)
        custom_clean
        return
        ;;
      4)
        printf '\n👋 已退出，没有清理任何文件。\n'
        return
        ;;
      *)
        printf '⚠ 看不懂这个选择，请输入 1、2、3 或 4。\n'
        ;;
    esac
  done
}

custom_clean() {
  local selected=()
  local i answer
  line
  printf '%b%s%b\n' "$BOLD" "📋 自己选择清理项目" "$NC"
  show_item_table
  printf '\n'
  for i in "${!ITEM_IDS[@]}"; do
    local size_fmt="$(format_size "$(bytes_from_kb "${ITEM_SIZES[$i]:-0}")")"
    printf '  %s [%s] —— %s：清理？输入 1 清理，输入 2 跳过：' \
      "${ITEM_TAGS[$i]}" "${ITEM_NAMES[$i]}" "$size_fmt"
    IFS= read -r answer
    if [ "$answer" = "1" ] || [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
      selected+=("$i")
      printf '    ✓ 已选择\n'
    else
      printf '    — 已跳过\n'
    fi
  done

  if [ "${#selected[@]}" -eq 0 ]; then
    printf '\n📭 没有选择任何清理项目。\n'
    return
  fi

  show_plan "📋 自选清理" "${selected[@]}"
  confirm_clean && clean_indexes "${selected[@]}"
}

# ──────────────────────────────────────────────
#  增强：完整前后对比报告
# ──────────────────────────────────────────────

final_report() {
  local before="$1"

  # 清理后，等文件系统稳定
  sync
  sleep 1

  local total_after used_after avail_after pct_after mount_after
  read -r total_after used_after avail_after pct_after mount_after < <(disk_line_for "$HOME_DIR")
  pct_after="${pct_after%%%}"

  AFTER_AVAIL_KB="$avail_after"
  local released=$((AFTER_AVAIL_KB - before))
  ((released < 0)) && released=0

  local color_before=$(status_color "$BEFORE_PCT")
  local color_after=$(status_color "$pct_after")
  local bar_before=$(bar_for_percent "$BEFORE_PCT")
  local bar_after=$(bar_for_percent "$pct_after")

  clear
  printf '%b' "$BOLD"
  thick_line
  printf '    十三哥 Steam Deck 空间清道夫 · 清理报告
'
  thick_line
  printf '%b
' "$NC"

  # 磁盘概览
  printf '
%b💾 磁盘概览%b
' "$BOLD" "$NC"
  line
  printf '  %-18s %15s  %15s
' '' '清理前' '清理后'
  line
  printf '  %-18s %15s  %15s
'     '总容量'     "$(format_size "$(bytes_from_kb "$BEFORE_TOTAL_KB")")"     "$(format_size "$(bytes_from_kb "$total_after")")"
  printf '  %-18s %15s  %15s
'     '已使用'     "$(format_size "$(bytes_from_kb "$BEFORE_USED_KB")")"     "$(format_size "$(bytes_from_kb "$used_after")")"
  printf '  %-18s %b%15s%b  %b%15s%b
'     '剩余空间'     "$color_before" "$(format_size "$(bytes_from_kb "$BEFORE_AVAIL_KB")")" "$NC"     "$color_after" "$(format_size "$(bytes_from_kb "$avail_after")")" "$NC"
  printf '  %-18s %b%s%% [%s]%b  %b%s%% [%s]%b
'     '使用率'     "$color_before" "$BEFORE_PCT" "$bar_before" "$NC"     "$color_after" "$pct_after" "$bar_after" "$NC"
  line

  # 释放汇总
  printf '
%b🔥 释放汇总%b
' "$BOLD" "$NC"
  printf '  本次实际释放：%b%s%b
' "$GREEN" "$(format_size "$(bytes_from_kb "$released")")" "$NC"
  if ((released < 1024 * 100)); then
    printf '  💡 提示：释放不明显时，建议卸载不常玩的游戏释放 GB 级空间。
'
  else
    printf '  ✅ 效果：空间已释放，可回到 Steam Deck 设置查看变化。
'
  fi

  printf '
%b🛡 安全红线%b
' "$BOLD" "$NC"
  printf '  ✓ 游戏存档（compatdata/*/users/）— 已保护
'
  printf '  ✓ Steam 游戏本体 — 未触及
'
  printf '  ✓ Proton 全局运行时 (compatdata/0) — 已跳过
'
  printf '  ✓ Flatpak 应用数据 — 已排除
'

  thick_line
}


# ──────────────────────────────────────────────
#  主入口
# ──────────────────────────────────────────────

clear
printf '%b' "$CYAN"
box_text "十三哥 Steam Deck 空间清道夫 v2"
printf '%b\n' "$NC"
printf '%b安全清理缓存 · 守护游戏存档 · 释放宝贵空间%b\n' "$DIM" "$NC"
line

read -r BEFORE_TOTAL_KB BEFORE_USED_KB BEFORE_AVAIL_KB BEFORE_PCT _ < <(disk_line_for "$HOME_DIR")
BEFORE_PCT="${BEFORE_PCT%%%}"
scan_items
show_disk_report
show_sd_cards

# 计算总值
total_scan=0
for s in "${ITEM_SIZES[@]}"; do total_scan=$((total_scan + s)); done

line
printf '\n%b🔍 扫描结果%b\n' "$BOLD" "$NC"
printf '  预计可优化空间：%b%s%b\n' "$YELLOW" "$(format_size "$(bytes_from_kb "$total_scan")")" "$NC"
printf '  其中一键推荐可释放：%b%s%b\n' "$GREEN" "$(format_size "$(bytes_from_kb "$(total_for_indexes 0 1 2 3 4 5 6 7 8 9)")")" "$NC"

main_menu
final_report "$BEFORE_AVAIL_KB"
