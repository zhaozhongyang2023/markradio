#!/usr/bin/env bash
##############################################
# MoodWave — Steam Deck WiFi 稳定性修复
# 解决睡眠唤醒断连、游戏模式掉线、DHCP 超时
# 用法: bash scripts/fix-wifi-steamdeck.sh [--dry-run]
##############################################
set -euo pipefail

WIFI_CONNECTION="${WIFI_CONNECTION:-NancyOpenWrt}"
DRY_RUN=0
[[ "${1:-}" = "--dry-run" ]] && DRY_RUN=1

GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'; RESET='\033[0m'
say()     { printf "${GREEN}[WiFi]${RESET} %s\n" "$1"; }
warn()    { printf "${YELLOW}[!]${RESET} %s\n" "$1" >&2; }
done_msg(){ printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
skip_msg(){ printf "${CYAN}[=]${RESET} %s\n" "$1"; }

[[ "$DRY_RUN" -eq 1 ]] && say "DRY-RUN 模式：只检查，不修改"

need_sudo() {
  [[ "$DRY_RUN" -eq 1 ]] && { echo "  [dry-run] sudo $*"; return 0; }
  sudo "$@"
}

# ── 1. NM dispatcher: mac80211 电源管理 ──
say "第 1/5 步：关闭 WiFi 电源管理（mac80211 层）"
DISPATCHER="/etc/NetworkManager/dispatcher.d/99-wifi-powersave-off"
if [[ -f "$DISPATCHER" ]]; then
  skip_msg "dispatcher 已存在"
else
  [[ "$DRY_RUN" -eq 0 ]] && {
    need_sudo tee "$DISPATCHER" > /dev/null <<'EOF'
#!/bin/bash
IFACE="$1"; ACTION="$2"
case "$IFACE" in wl*) ;; *) exit 0 ;; esac
[ "$ACTION" = "up" ] && /usr/bin/iw dev "$IFACE" set power_save off
EOF
    need_sudo chmod 755 "$DISPATCHER"
  }
  done_msg "dispatcher 已创建"
fi

# ── 2. modprobe: rtw88 驱动层电源管理 ──
say "第 2/5 步：关闭 rtw88 驱动层电源管理"
MODPROBE="/etc/modprobe.d/rtw88.conf"
if [[ -f "$MODPROBE" ]]; then
  skip_msg "rtw88.conf 已存在"
else
  [[ "$DRY_RUN" -eq 0 ]] && {
    need_sudo tee "$MODPROBE" > /dev/null <<'EOF'
options rtw88_core disable_lps_deep=Y
options rtw88_pci disable_aspm=Y
EOF
  }
  done_msg "rtw88.conf 已创建"
fi

# ── 3. systemd: PCIe ASPM ──
say "第 3/5 步：禁用 PCIe ASPM（链路层省电）"
ASPM_SVC="/etc/systemd/system/disable-wifi-aspm.service"
if [[ -f "$ASPM_SVC" ]]; then
  skip_msg "ASPM 服务已存在"
else
  [[ "$DRY_RUN" -eq 0 ]] && {
    need_sudo tee "$ASPM_SVC" > /dev/null <<'EOF'
[Unit]
Description=Disable PCIe ASPM for WiFi stability
After=multi-user.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c "echo performance > /sys/module/pcie_aspm/parameters/policy"
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
    need_sudo systemctl daemon-reload
    need_sudo systemctl enable disable-wifi-aspm.service
  }
  done_msg "ASPM 服务已创建"
fi

# ── 4. systemd: 睡眠唤醒恢复 ──
say "第 4/5 步：睡眠唤醒自动恢复 WiFi"
RESUME_SVC="/etc/systemd/system/moodwave-wifi-resume.service"
RESUME_SCRIPT="/usr/local/bin/moodwave-wifi-resume.sh"
if [[ -f "$RESUME_SVC" ]]; then
  skip_msg "唤醒服务已存在（覆盖更新）"
fi
[[ "$DRY_RUN" -eq 0 ]] && {
  need_sudo tee "$RESUME_SVC" > /dev/null <<EOF
[Unit]
Description=恢复 WiFi 连接（睡眠唤醒后）
After=suspend.target
[Service]
Type=simple
ExecStart=$RESUME_SCRIPT
Restart=no
[Install]
WantedBy=suspend.target
EOF
  need_sudo tee "$RESUME_SCRIPT" > /dev/null <<'SCRIPT'
#!/bin/bash
LOG_TAG="moodwave-wifi-resume"
WIFI_IFACE="wlan0"
WIFI_CONN="NancyOpenWrt"

logger -t "$LOG_TAG" "唤醒检测到，等待 WiFi 就绪..."

for i in $(seq 1 120); do
    if ip link show "$WIFI_IFACE" >/dev/null 2>&1; then
        logger -t "$LOG_TAG" "wlan0 就绪（等待 ${i}s）"
        break
    fi
    sleep 1
done

iw dev "$WIFI_IFACE" set power_save off 2>/dev/null
logger -t "$LOG_TAG" "power_save off"
sleep 3

for i in $(seq 1 30); do
    if nmcli -t -f GENERAL.STATE dev show "$WIFI_IFACE" 2>/dev/null | grep -q "100"; then
        logger -t "$LOG_TAG" "已连接（尝试 ${i}）"
        exit 0
    fi
    nmcli con up "$WIFI_CONN" 2>/dev/null
    sleep 2
done

logger -t "$LOG_TAG" "连接失败"
exit 1
SCRIPT
  need_sudo chmod 755 "$RESUME_SCRIPT"
  need_sudo systemctl daemon-reload
  need_sudo systemctl enable moodwave-wifi-resume.service
}
done_msg "唤醒服务已创建"

# ── 5. NM 连接: 手动 IP + 阻断 DHCP ──
say "第 5/5 步：手动 IP + 阻断 DHCP 回退"
[[ "$DRY_RUN" -eq 0 ]] && {
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.method manual 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.addresses "192.168.3.121/24" 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.gateway "192.168.3.254" 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.dns "114.114.114.114,8.8.8.8" 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.may-fail no 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.dhcp-send-hostname no 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" ipv4.ignore-auto-dns yes 2>/dev/null || true
  need_sudo nmcli con mod "$WIFI_CONNECTION" connection.autoconnect-priority 100 2>/dev/null || true
}
done_msg "NM 手动 IP 已配置"

# ── 激活 ──
[[ "$DRY_RUN" -eq 0 ]] && {
  need_sudo nmcli con down "$WIFI_CONNECTION" 2>/dev/null || true
  sleep 2
  need_sudo nmcli con up "$WIFI_CONNECTION" 2>/dev/null || true
}

echo ""
echo "  WiFi 稳定性修复完成，建议重启 Steam Deck。"
echo "  验证: nmcli -f ipv4.method,ipv4.may-fail con show NancyOpenWrt"
