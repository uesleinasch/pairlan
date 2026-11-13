# Material Design 3 no PairLAN

O Material 3 (M3) é o design system do Google. Os valores abaixo foram **conferidos nos tokens oficiais** que vêm com o `@material/web` 2.5.0 (`node_modules/@material/web/tokens/versions/v0_192/`). O site m3.material.io é renderizado no cliente e não pôde ser lido direto.

## Implementação escolhida: `@material/web`

- É a implementação oficial do Google do M3 em Web Components (Lit).
- **Status: modo de manutenção desde junho de 2024.** Não é "deprecated", mas não recebe features novas. Correções entram caso a caso.
- Por que usar mesmo assim:
  - é a referência oficial de M3 para web;
  - é estável e tem os componentes que o app precisa;
  - funciona bem com React 19, que passa props como properties e liga eventos pelo nome literal (`oninput` → `input`).
- Não tem: top app bar, snackbar, side sheet, navigation rail com rótulos. Esses são feitos à mão, com os mesmos tokens.
- Alternativas se um dia for preciso trocar: M3E e mdui (Web Components M3 mantidos pela comunidade).

Fontes: [Material Web](https://material-web.dev), [Discussão "MWC is in maintenance mode" #5642](https://github.com/material-components/material-web/discussions/5642)

## Cor

- O esquema de cores é gerado a partir de **uma cor-semente** com a `@material/material-color-utilities` (variante *tonal spot*). A semente é o teal do ícone, `#0F766E`. São gerados esquemas claro e escuro.
- **Papéis de cor**: o app usa os papéis, nunca hex direto.
  - `primary`/`on-primary`: ação principal (Enviar).
  - `primary-container`/`on-primary-container`: destaque suave (minhas mensagens, chip selecionado).
  - `secondary-container`: ações tonais.
  - `tertiary`/`tertiary-container`: realce diferente da primária (estado "no ar").
  - `error`/`error-container`: erros e "transmitindo/parar".
  - `surface`, `surface-container-low` … `surface-container-highest`: camadas de fundo. Elevação no M3 é expressa principalmente por **tom de superfície**, não por sombra.
  - `outline`/`outline-variant`: bordas e divisores.
- Os pares `X`/`on-X` são desenhados para dar contraste acessível.

Fontes: [Material Web — Color](https://material-web.dev/theming/color/), [material-color-utilities](https://www.npmjs.com/package/@material/material-color-utilities)

## Tipografia (type scale)

Roboto (self-hosted via `@fontsource/roboto`, porque o app roda offline). Tokens usados:

| Papel | Tamanho / altura de linha | Uso |
|---|---|---|
| Title medium | 1rem / 1.5rem | nome do par na barra |
| Title small | 0.875rem / 1.25rem | títulos de cards |
| Body large | 1rem / 1.5rem | campo de mensagem |
| Body medium | 0.875rem / 1.25rem | texto das mensagens |
| Body small | 0.75rem / 1rem | metadados, horário |
| Label large | 0.875rem / 1.25rem | botões e chips |
| Label medium | 0.75rem / 1rem | status |

Fonte: [Material Web — Typography](https://material-web.dev/theming/typography/)

## Forma (shape)

| Token | Valor | Uso no app |
|---|---|---|
| corner-extra-small | 4px | blocos de código |
| corner-small | 8px | chips, anexos |
| corner-medium | 12px | cards |
| corner-large | 16px | balões de mensagem |
| corner-extra-large | 28px | diálogo, botão de falar |
| corner-full | 9999px | botões, status |

Fonte: [Material Web — Shape](https://material-web.dev/theming/shape/)

## Estados (state layers)

Uma camada da cor do conteúdo é aplicada sobre o componente para indicar o estado:

| Estado | Opacidade (token oficial) |
|---|---|
| hover | 0.08 |
| focus | 0.12 |
| pressed | 0.12 |
| dragged | 0.16 |

Componente desabilitado: conteúdo a 38% e container a 12% (convenção M3). Os componentes do `@material/web` já trazem state layer, ripple e focus ring. Os elementos feitos à mão reproduzem esses valores.

## Elevação

Níveis 0–5 com 0, 1, 3, 6, 8 e 12 dp. No PairLAN, a hierarquia vem dos tons `surface-container-*`. Só o diálogo e o snackbar usam sombra (nível 3).

## Movimento

Durações oficiais: short 50–200 ms, medium 250–400 ms. O app usa short4 (200 ms) para trocar de estado e medium2 (300 ms) para entrar/sair do snackbar. Respeita `prefers-reduced-motion`.

## Layout (window size classes)

M3 define classes por largura: compacta (< 600dp), média (600–839dp) e expandida (≥ 840dp). O PairLAN costuma ficar compacto (janela estreita ao lado do editor). Na largura média ou maior, com tela remota aberta, a tela fica à esquerda e o chat à direita (painéis lado a lado).

Fonte: [M3 — Window size classes](https://m3.material.io/foundations/layout/applying-layout/window-size-classes) (página client-side; valores conforme a documentação M3)

## Componentes `@material/web` usados

| Necessidade | Componente |
|---|---|
| Ações da barra / janela | `md-icon-button` |
| Toggles de mídia (Tela, Áudio do PC, Ouvir ao vivo) | `md-filter-chip` em `md-chip-set` |
| Enviar | `md-filled-icon-button` |
| Falar (PTT) | botão grande, com shape extra-large e state layer próprio (o `md-fab` não expõe pointerup/down de forma confiável para segurar) |
| Campo de mensagem | `md-outlined-text-field` (`type="textarea"`) |
| Configurações | `md-dialog` com `md-outlined-text-field`, `md-slider`, `md-switch`, `md-list` |
| Progresso de transferência | `md-linear-progress` |
| Volume do áudio do PC | `md-slider` |
| Ícones | `md-icon` + Material Symbols Outlined (self-hosted, pacote `material-symbols`) |
