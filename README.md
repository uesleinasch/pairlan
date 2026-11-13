# PairLAN

Chat e compartilhamento de tela para pair programming, 100% em rede local. É feito para duas pessoas: não tem senha nem servidor, e nada sai da LAN.

- O par é achado sozinho na rede (broadcast UDP). Se isso falhar, dá para digitar o IP.
- O chat aceita blocos de código com ` ``` `, mostra quando o outro está digitando e guarda o histórico. Dá para apagar o histórico em Configurações (ou `/apagar` no modo terminal). Só apaga deste PC; os arquivos recebidos ficam na pasta.
- Anexos: botão 📎, arrastar ou colar (inclusive print da área de transferência). Até 500 MB por arquivo. O que chega vai para `~/Downloads/PairLAN`.
- Walkie-talkie: segure 🎙 ou **Ctrl+Espaço** para falar e solte para encerrar. Quando o bipe toca, o canal está no ar.
  - Se o outro estiver em 🔊, ouve na hora.
  - Se estiver em 🔇 (ex.: numa call do Teams), sua fala chega como mensagem de voz no chat.
  - Se o canal ao vivo não conectar, a gravação vai como mensagem do mesmo jeito.
- Áudio do PC (🎧): transmite o som da máquina em tempo real, sem compartilhar a tela (ex.: o áudio da call do Teams do outro).
  - O app cria uma fonte virtual (`pw-loopback`, do pacote `pipewire-bin`) só enquanto transmite. Ela não vira o microfone padrão.
  - Quem recebe ajusta o volume e pode silenciar. Se estiver em 🔇, já começa mudo.
  - Quando você fala no walkie, esse áudio abaixa sozinho, para não ouvir o eco da própria voz.
- Os dois podem compartilhar a tela ao mesmo tempo. O vídeo vai via WebRTC, direto entre as máquinas.
- Laser: quem vê a tela do par liga o laser e aponta. Um ponto vermelho aparece na tela de quem compartilha, e um clique faz um anel.
  - O ponto vai para o monitor que tem o mesmo tamanho da captura. Funciona com monitor inteiro, não com janela.
- Controle remoto: quem compartilha clica em **Permitir controle**. O GNOME pede permissão e mostra o ícone de compartilhamento na barra do topo.
  - Quem vê clica no 🖱 da tela do par para usar mouse, clique, rolagem e teclado.
  - Bloqueia de novo pelo mesmo chip, pelo ícone do GNOME, ou parando o compartilhamento. Cair a conexão também bloqueia.
  - No diálogo do GNOME, escolha o mesmo monitor que está compartilhando.
- Modo terminal: o app fica com cara de terminal do Ubuntu, para pedir ajuda sem chamar atenção.
  - Título com uma pasta falsa (`~/Code/api`), prompt estilo powerline com pasta e branch falsos, ícone de terminal, fundo escuro, chat em forma de log, sem bolhas nem botões. Pasta e branch mudam no `/config`.
  - As ações viram comandos (`/tela`, `/audio`, `/anexo`, `/controle`, `/config`…) e itens na barra verde de baixo. `/help` lista tudo, Tab completa.
  - A notificação de mensagem nova vira "Terminal — Comando concluído".
  - Liga em Configurações, no menu da bandeja ou com `/tema` (que também desliga).
- Modo discreto: ícone na bandeja com contador, janela transparente (30–100%), "sempre no topo". Notificação de mensagem nova só aparece com a janela minimizada ou na bandeja (dá para desligar).

## Interface

A interface segue o Material Design 3 (`@material/web`), com tema claro/escuro do sistema. Os princípios de UX e as decisões de design estão em [docs/ux](docs/ux/README.md).

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
3. Se for compartilhar a tela inteira, desligue "Notificar quando minimizado": o banner do GNOME aparece na captura.

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
