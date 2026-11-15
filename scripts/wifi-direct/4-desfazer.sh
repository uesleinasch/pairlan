#!/usr/bin/env bash
source "$(dirname "$0")/comum.sh"

nmcli connection down "$CON" >/dev/null 2>&1 || true
nmcli connection delete "$CON" >/dev/null 2>&1 || true
sleep 1
cleanup_leftovers
echo "OK: Wi-Fi Direct desfeito. Rede da empresa: $(company_ssid)"
