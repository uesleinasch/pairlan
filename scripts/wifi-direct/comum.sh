#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "ERRO: falhou na linha $LINENO: $BASH_COMMAND" >&2' ERR

CON=pairlan-p2p
NET=${NET:-10.42.99}
WLAN=${WLAN:-$(iw dev | awk '$1=="Interface" && $2 !~ /^p2p-/ {print $2; exit}')}
[[ -n $WLAN ]] || { echo "ERRO: placa Wi-Fi não encontrada" >&2; exit 1; }
LEGACY_NM_CONF=/etc/NetworkManager/conf.d/99-pairlan-wifi-direct.conf

die() { echo "ERRO: $*" >&2; exit 1; }
my_p2p_addr() { iw dev | awk '$1=="addr" {a=$2} $1=="type" && $2=="P2P-device" {print a; exit}'; }
group_iface() { iw dev | awk '$1=="Interface" {i=$2} $1=="type" && $2 ~ /^P2P-(GO|client)$/ {print i; exit}'; }
company_ssid() { iw dev "$WLAN" link | awk '/SSID/{print $2}'; }

cleanup_leftovers() {
  if [[ -f $LEGACY_NM_CONF ]]; then
    sudo rm -f "$LEGACY_NM_CONF"
    sudo nmcli general reload conf
  fi
  local g
  while g=$(group_iface); [[ -n $g ]]; do
    sudo iw dev "$g" del
  done
}
