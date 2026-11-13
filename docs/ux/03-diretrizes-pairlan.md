# Diretrizes de UX do PairLAN

Aplica os princípios de [01-principios-ux.md](01-principios-ux.md) com o sistema visual de [02-material-design-3.md](02-material-design-3.md).

## Contexto de uso

- Dois devs em pair programming. Muitas vezes os dois estão em **outra call** (Teams) ao mesmo tempo.
- A janela é **estreita** (~420 px), fica ao lado do editor, às vezes semi-transparente e por cima do código.
- A atenção está no código. O app precisa ser lido **de relance** e operado com **pouco esforço**.
- Os dois usam Linux, GNOME, Wayland e tema escuro ou claro do sistema.

## Auditoria da UI v0.1 / branches atuais

| Problema | Heurística/lei violada | Correção |
|---|---|---|
| Ícones em emoji (⚙ 🎧 🔊 ✕) sem rótulo e com estilo inconsistente | 4 Consistência, 6 Reconhecer | Material Symbols + tooltip + `aria-label` |
| 7 ações na barra superior de 420 px | Hick, 8 Minimalismo | Barra só com busca e Configurações; minimizar e fechar ficam na barra de título do GNOME. Mídia num grupo próprio |
| Toggles de mídia (tela, áudio do PC, ouvir ao vivo) parecem botões soltos e o estado "ligado" não é óbvio | 1 Status, Similaridade | `md-filter-chip` com estado selecionado e ícone que muda |
| Status só com bolinha colorida | WCAG 1.4.1 | Ícone + texto ("Conectado a Ana", "Procurando…") |
| Erros como texto cinza que não some e não sugere solução | 9 Erros | Snackbar com mensagem clara e ação ("Configurar IP", "Tentar de novo") |
| Botão de falar pequeno (emoji) | Fitts, padrões de PTT | Botão grande (56 px), forma extra-large e estado "no ar" com cor de destaque |
| Sem par conectado = tela vazia | 10 Ajuda, 1 Status | Estado vazio com progresso indeterminado, explicação e atalho para IP manual |
| Configurações empurram o chat | 3 Controle, 8 Minimalismo | `md-dialog` modal, fecha com Esc |
| Atalhos (Ctrl+Espaço, Enter) invisíveis | 6 Reconhecer, 7 Eficiência | Seção "Atalhos" nas configurações, hint no tooltip e no placeholder |
| Foco de teclado inconsistente | WCAG 2.4.7 | `md-focus-ring` dos componentes e `:focus-visible` nos elementos próprios |

## Estrutura da tela (compacta, < 600 px)

```
┌ Barra superior (arrasta a janela) ───────────────┐
│ (ícone status) Nome do par          ⚙   –   ✕    │
│                Conectado · transmitindo tela      │
├ Controles de mídia (chip set) ───────────────────┤
│ [▣ Minha tela] [🎧 Áudio do PC] [🔊 Ouvir ao vivo]│
├ Card: tela de Fulano    [ajustar] [tela cheia]   │
├ Card: áudio do PC de Fulano  ───●─── [mudo]      │
├ Mensagens ───────────────────────────────────────┤
│  balão do par (surface-container-high)            │
│                    meu balão (primary-container)  │
├ Transferências (linear progress) ────────────────┤
├ Linha de status: "No ar — pode falar" / digitando │
│ [📎] [ campo de mensagem…        ] [➤] [ 🎙 ]     │
└──────────────────────────────────────────────────┘
          Snackbar (erros e avisos) acima do composer
```

- **Proximidade e região comum:**
  - ações de janela ficam juntas, à direita da barra;
  - ações de mídia, num grupo próprio logo abaixo;
  - cada mídia remota fica dentro de um card.
- **Fitts:**
  - o botão de falar é o maior alvo do composer;
  - Enviar fica ao lado do campo;
  - todo alvo tem ≥ 40 px.
- **Largura ≥ 600 px com tela remota:** a tela fica à esquerda e o chat à direita.

## Estados e feedback

| Situação | Feedback |
|---|---|
| Procurando par | Estado vazio com ícone, texto e `md-linear-progress` indeterminado. Botão "Conectar por IP" |
| Conectando | Subtítulo "Conectando…" com ícone `sync` |
| Conectado | Subtítulo "Conectado · IP" com ícone `link` |
| Transmitindo tela/áudio | Chip selecionado (ícone `stop_circle`). O subtítulo lista o que está saindo ("transmitindo tela, áudio") |
| Walkie: abrindo canal | Botão em `secondary-container`. Linha de status "Abrindo canal…" |
| Walkie: no ar | Botão em `error` com anel pulsante (sem animação se `prefers-reduced-motion`). Status "No ar — pode falar" e bipe |
| Walkie: gravando mensagem | Botão em `tertiary`. Status "Gravando mensagem de voz…" |
| Par falando | Faixa "Fulano falando…" com ícone `graphic_eq` |
| Erro (mic, IP, pw-loopback) | Snackbar com texto claro e ação quando houver |
| Arrastar arquivo | Overlay "Solte para enviar" com borda tracejada `primary` |

## Linguagem (heurística 2)

- Português direto, sem jargão: "Áudio do PC" (não "loopback"), "Procurando o par na rede" (não "broadcast UDP").
- Verbos nas ações: "Conectar", "Enviar", "Falar", "Parar".
- Mensagens de erro dizem o que houve e o que fazer: "Microfone indisponível. Verifique se outro app está usando."

## Acessibilidade (checklist)

- [ ] Todo icon button tem `aria-label` e tooltip (`title`).
- [ ] Status nunca só por cor: ícone e texto juntos.
- [ ] Contraste via papéis M3 (`on-*` sobre o container correspondente).
- [ ] Alvos ≥ 24 px (padrão M3: 40 px).
- [ ] Tudo funciona por teclado: Tab, Enter, Esc no diálogo, Ctrl+Espaço para falar.
- [ ] Arrastar arquivo tem alternativa por clique (📎).
- [ ] `prefers-reduced-motion` desliga pulsos e transições.
- [ ] Opacidade da janela nunca deixa o conteúdo abaixo de 75% (o texto continua legível).
