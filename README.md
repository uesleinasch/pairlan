# PairLAN

Chat e compartilhamento de tela para pair programming, 100% em rede local. É feito para duas pessoas: não tem senha nem servidor, e nada sai da LAN.

- O par é achado sozinho na rede (broadcast UDP). Se isso falhar, dá para digitar o IP.
- O chat aceita blocos de código com ` ``` `, mostra quando o outro está digitando e guarda o histórico.
- Anexos: botão 📎, arrastar ou colar (inclusive print da área de transferência). Até 500 MB por arquivo. O que chega vai para `~/Downloads/PairLAN`.
- Walkie-talkie: segure 🎙 ou **Ctrl+Espaço** para falar e solte para encerrar. Quando o bipe toca, o canal está no ar.
  - Se o outro estiver em 🔊, ouve na hora.
  - Se estiver em 🔇 (ex.: numa call do Teams), sua fala chega como mensagem de voz no chat.
  - Se o canal ao vivo não conectar, a gravação vai como mensagem do mesmo jeito.
- Os dois podem compartilhar a tela ao mesmo tempo. O vídeo vai via WebRTC, direto entre as máquinas.
- Modo discreto: ícone na bandeja com contador, janela transparente (30–100%), "sempre no topo", e notificação do sistema desligada por padrão.

## Instalar

Baixe o `.AppImage` na [última release](https://github.com/uesleinasch/pairlan/releases/latest):

```bash
chmod +x PairLAN-*.AppImage
./PairLAN-*.AppImage
```

No Ubuntu, o AppImage precisa do `libfuse2` (`sudo apt install libfuse2t64`).

## Não aparecer no Teams

No Linux (GNOME/Wayland) não existe API que tire uma janela da captura de tela. Então:

1. No Teams, compartilhe **só uma janela/aba** ou **só um monitor**.
2. Deixe o PairLAN no **outro** monitor, ou fora da janela compartilhada.
3. Deixe a notificação do sistema desligada: o banner do GNOME aparece em captura de tela cheia.

O app também liga `setContentProtection(true)`. No Linux isso não faz nada, mas no Windows e no macOS esconde a janela da captura.

## Rede

| Porta | Uso |
|---|---|
| 47800/udp | descoberta (broadcast) |
| 47801/tcp | chat e sinalização (WebSocket) |
| UDP efêmeras | vídeo (WebRTC) |

Se o `ufw` estiver ativo, libere a sub-rede local:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 47800 proto udp
sudo ufw allow from 192.168.0.0/16 to any port 47801 proto tcp
sudo ufw allow from 192.168.0.0/16 proto udp
```

O app só aceita conexões vindas de IP privado (10/8, 172.16/12, 192.168/16, 169.254/16).

Em Wi-Fi corporativo com isolamento de clientes, nada passa. Nesse caso use cabo ou outra rede.

## Desenvolver

```bash
npm install
npm run dev        # app em modo dev
npm test           # testes
npm run typecheck
npm run dist       # gera dist/*.AppImage
```

Para testar a dois na mesma máquina, use `npm run pair`. Ele faz o build e abre duas instâncias (perfis `a` e `b`) que se conectam sozinhas. Os anexos recebidos vão para `~/Downloads/PairLAN-a` e `~/Downloads/PairLAN-b`.

Também dá para subir cada uma na mão:

```bash
PAIRLAN_PROFILE=a npm run dev
PAIRLAN_PROFILE=b PAIRLAN_PORT_OFFSET=1 npm run dev
```

O fluxo de branches e releases está em [CONTRIBUTING.md](CONTRIBUTING.md).
