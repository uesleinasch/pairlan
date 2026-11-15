#!/usr/bin/env bash
source "$(dirname "$0")/comum.sh"

echo "Rede da empresa: $(company_ssid)"
echo "Conexão $CON: $(nmcli -g GENERAL.STATE connection show "$CON" 2>/dev/null || echo 'não existe')"
g=$(group_iface)
[[ -n $g ]] || { echo "Wi-Fi Direct: sem grupo ativo"; exit 0; }
echo "Wi-Fi Direct:"
ip -br addr show "$g"
iw dev "$g" info | grep -E 'type|channel' || true
iw dev "$g" station dump 2>/dev/null | grep -E 'Station|tx bitrate|rx bitrate|signal:' || true
iw dev "$g" link 2>/dev/null | grep -E 'Connected|bitrate|signal' || true
