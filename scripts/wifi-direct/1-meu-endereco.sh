#!/usr/bin/env bash
source "$(dirname "$0")/comum.sh"

addr=$(my_p2p_addr)
[[ -n $addr ]] || die "esta placa não tem Wi-Fi Direct (P2P-device) ativo"
echo "Endereço Wi-Fi Direct desta máquina:"
echo
echo "    $addr"
echo
echo "Passe esse endereço para a outra máquina. Ela vai rodar: ./2-conectar.sh $addr"
