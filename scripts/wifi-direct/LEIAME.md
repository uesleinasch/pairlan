# Teste de Wi-Fi Direct entre duas máquinas

Objetivo: ligar duas máquinas por Wi-Fi Direct **sem sair do Wi-Fi da empresa** e ver se o PairLAN funciona por esse link.

Os scripts usam o próprio NetworkManager (conexão do tipo `wifi-p2p` chamada `pairlan-p2p`). O Wi-Fi da empresa continua ligado.

## Antes de começar

- As duas máquinas são Ubuntu com Wi-Fi ligado na rede da empresa.
- As duas precisam desta pasta (`scripts/wifi-direct`) completa.
- Dentro da pasta, rode uma vez em cada máquina:

```bash
chmod +x *.sh
```

## Passo a passo

Faça nas duas máquinas, A e B.

| # | Onde | Comando | O que esperar |
|---|------|---------|---------------|
| 1 | A e B | `./1-meu-endereco.sh` | Mostra o endereço da máquina. Anote o de cada uma. |
| 2 | A e B, **ao mesmo tempo** | `./2-conectar.sh <endereço da OUTRA máquina>` | `OK: conectado` e 3 pings respondidos |
| 3 | A e B | `./3-status.sh` | A rede da empresa continua conectada, e aparece o Wi-Fi Direct com IP |
| 4 | A e B | Teste o PairLAN (abaixo) | |
| 5 | A e B | `./4-desfazer.sh` | `OK: Wi-Fi Direct desfeito` |

No passo 2, as duas máquinas precisam estar tentando juntas. O script tenta 6 vezes, cerca de 4 minutos no total. Rode nas duas com poucos segundos de diferença.

O IP sai sozinho: uma máquina fica com `10.42.99.1` e a outra com `10.42.99.2`. O passo 2 mostra qual IP usar no PairLAN.

## Testar o PairLAN

1. Abra o PairLAN nas duas máquinas.
2. Conecte pelo **IP manual** que o passo 2 mostrou (`10.42.99.1` ou `10.42.99.2`). Não use a descoberta automática: ela pode achar a outra máquina pela rede da empresa, e aí o teste não vale.
3. Teste e anote:
   - chat
   - compartilhar tela
   - walkie (🎙)
   - enviar um arquivo grande (100 MB ou mais), anotando quanto tempo levou
4. Enquanto isso, abra um site ou o Teams e veja se a internet da empresa continua normal.

## O que mandar de volta

- A saída de cada comando, das duas máquinas, mesmo se der certo.
- A saída do `./3-status.sh` com o PairLAN conectado.
- O que funcionou e o que não funcionou no PairLAN, e o tempo do arquivo grande.
- Se der erro, a mensagem `ERRO: ...` completa e a saída de `journalctl -u NetworkManager --since -5min | grep -i p2p`.
