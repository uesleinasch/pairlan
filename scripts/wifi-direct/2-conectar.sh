#!/usr/bin/env bash
source "$(dirname "$0")/comum.sh"

peer=${1:-}
peer=${peer,,}
[[ $peer =~ ^([0-9a-f]{2}:){5}[0-9a-f]{2}$ ]] || die "uso: ./2-conectar.sh <endereço da OUTRA máquina> (ex.: fc:b3:aa:bc:44:ff)"
me=$(my_p2p_addr)
[[ -n $me ]] || die "esta placa não tem Wi-Fi Direct (P2P-device) ativo"
[[ $peer != "$me" ]] || die "esse é o endereço DESTA máquina; use o da outra"

if [[ $me < $peer ]]; then mine=$NET.1 other=$NET.2; else mine=$NET.2 other=$NET.1; fi

cleanup_leftovers
nmcli connection delete "$CON" >/dev/null 2>&1 || true
nmcli connection add type wifi-p2p con-name "$CON" wifi-p2p.peer "$peer" \
  connection.autoconnect no ipv4.method manual ipv4.addresses "$mine/24" ipv6.method disabled >/dev/null

echo "Conectando em $peer (eu = $mine). Rode o mesmo passo na outra máquina agora."
ok=
for t in 1 2 3 4 5 6; do
  echo "Tentativa $t de 6..."
  if nmcli --wait 40 connection up "$CON" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[[ -n $ok ]] || die "não conectou. As duas máquinas rodaram o passo 2 ao mesmo tempo?"

echo "OK: conectado em $(group_iface) (IP $mine). Testando ping em $other..."
ping -c3 -W2 "$other"
echo
echo "No PairLAN, conecte pelo IP manual $other."
