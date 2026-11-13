# Princípios de UX/UI

Pesquisa feita em 13/11/2026. Junta as referências usadas para desenhar a interface do PairLAN. As fontes estão no fim de cada seção.

## 1. As 10 heurísticas de Nielsen (NN/g)

São regras gerais para inspecionar uma interface e prever onde o usuário vai travar. Jakob Nielsen as publicou em 1994, e a NN/g ainda as usa como base de avaliação heurística.

| # | Heurística | Ideia central | Como aplicar |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | Manter o usuário informado do que está acontecendo, com feedback adequado e em tempo razoável. | Feedback imediato. Nenhuma ação com consequência acontece sem aviso. |
| 2 | Correspondência entre sistema e mundo real | Falar a língua do usuário, com conceitos familiares. | Evitar jargão técnico. Usar metáforas reais (ex.: walkie-talkie). |
| 3 | Controle e liberdade do usuário | O usuário precisa de uma "saída de emergência" clara. | Desfazer/cancelar visível. Parar o que foi iniciado com um clique. |
| 4 | Consistência e padrões | O usuário não deve se perguntar se palavras ou ações diferentes significam a mesma coisa. Seguir as convenções da plataforma (Lei de Jakob). | Um único sistema de componentes, ícones e termos. |
| 5 | Prevenção de erros | Melhor do que boa mensagem de erro é evitar o erro. Há dois tipos: *slips* (desatenção) e *mistakes* (modelo mental errado). | Eliminar condições propensas a erro. Desabilitar ações impossíveis. |
| 6 | Reconhecer em vez de lembrar | Minimizar a carga de memória deixando elementos, ações e opções visíveis. | Rótulos e tooltips. Estado sempre visível. Atalhos documentados na UI. |
| 7 | Flexibilidade e eficiência de uso | Atalhos (*accelerators*) para quem já é experiente, sem atrapalhar o iniciante. | Atalhos de teclado e personalização. |
| 8 | Design estético e minimalista | Cada elemento extra compete com o essencial. | Priorizar o conteúdo e as ações principais. Esconder o secundário. |
| 9 | Ajudar a reconhecer, diagnosticar e corrigir erros | Mensagens em linguagem simples, dizendo o problema com precisão e sugerindo a solução. | Visual de erro tradicional, texto claro e ação de correção imediata. |
| 10 | Ajuda e documentação | O ideal é não precisar, mas quando precisar, deve estar no contexto. | Dicas no lugar certo e estados vazios que ensinam. |

Fonte: [NN/g — 10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 2. Laws of UX (psicologia aplicada)

| Lei | Definição (lawsofux.com) | Implicação no PairLAN |
|---|---|---|
| Fitts | O tempo para atingir um alvo é função da distância e do tamanho do alvo. | Ação principal grande e perto de onde a mão/atenção já está (o botão de falar fica ao lado do campo de texto). |
| Hick | O tempo de decisão cresce com o número e a complexidade das escolhas. | Poucas ações na barra superior. O secundário vai para Configurações. |
| Jakob | Usuários passam a maior parte do tempo em outros produtos e esperam que o seu funcione igual. | Padrões de chat conhecidos: composer embaixo, mensagens próprias à direita, Enter envia. |
| Miller | A memória de trabalho guarda cerca de 7 ± 2 itens. | Agrupar controles em blocos pequenos. |
| Proximidade | Objetos próximos são percebidos como grupo. | Controles de mídia juntos. Controles de janela separados. |
| Região comum | Elementos dentro de uma área com borda clara são percebidos como grupo. | Cards para tela remota e para áudio do PC. |
| Similaridade | Elementos parecidos são percebidos como relacionados. | Todos os toggles de mídia com o mesmo componente (filter chip). |
| Von Restorff | Entre itens parecidos, o diferente é lembrado. | O estado "no ar" e "transmitindo" tem cor de destaque única. |
| Doherty | A produtividade dispara quando a interação responde em menos de 400 ms. | Feedback visual imediato ao apertar (state layer e ripple). Bipe quando o canal abre. |
| Tesler | Existe uma complexidade que não pode ser eliminada, só deslocada. | A rede (descoberta, IP, portas) fica com o app. O usuário só vê "conectado". |
| Postel | Seja liberal no que aceita e conservador no que envia. | Aceitar arquivo por clique, arrastar ou colar. Validar IP com mensagem clara. |
| Peak-End | A experiência é julgada pelo pico e pelo final. | O fim de cada ação (envio concluído, fim da fala) tem confirmação clara. |
| Estético-usabilidade | Design bonito é percebido como mais usável. | Sistema visual coeso (Material 3). |

Fonte: [Laws of UX](https://lawsofux.com/)

## 3. Acessibilidade (WCAG 2.2, nível AA)

Critérios que valem para uma app desktop de chat e mídia:

- **1.4.3 Contraste mínimo:** texto com 4.5:1 (3:1 para texto grande).
- **1.4.11 Contraste não textual:** ícones, bordas de controles e indicador de foco com 3:1.
- **1.4.1 Uso de cor:** a cor nunca é o único meio de passar a informação. Status com cor **e** texto/ícone.
- **2.1.1 Teclado:** tudo operável por teclado.
- **2.4.7 Foco visível**, e **2.4.11 Foco não obscurecido (mínimo)** (novo na 2.2): o componente focado não pode ficar totalmente escondido por conteúdo do autor.
- **2.4.13 Aparência do foco** (AAA, como referência): o indicador tem pelo menos o perímetro de 2 px do componente e contraste de 3:1.
- **2.5.7 Movimentos de arrastar** (novo na 2.2): o que funciona arrastando precisa de alternativa com um ponteiro só. Arrastar arquivo tem o botão 📎 como alternativa.
- **2.5.8 Tamanho do alvo (mínimo)** (novo na 2.2): alvos de pelo menos 24×24 px CSS, ou com espaçamento suficiente. Os icon buttons do M3 têm 40 px, acima disso.
- **4.1.2 Nome, função, valor:** botões só com ícone precisam de nome acessível (`aria-label`).

Fontes: [W3C — What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 4. Padrões de push-to-talk (walkie-talkie)

Há poucas diretrizes formais. Os padrões mais recorrentes:

- **Segurar para falar** é o padrão conhecido. Soltar volta ao modo de escuta.
- O **botão precisa ser grande**. Usuários reclamam de botões de PTT pequenos que falham no toque.
- É bom oferecer **atalho físico/teclado** além do botão na tela.
- **Feedback de transmissão** (visual e sonoro) é essencial: o usuário precisa saber quando já está no ar.

Fontes: [LiveAvatar — Push-to-talk](https://docs.liveavatar.com/docs/full-mode/push-to-talk.md), [Discord — tamanho do botão de PTT](https://support.discord.com/hc/fr/community/posts/360042805512-Push-to-talk-button-size-in-mobile-app), [TeamSpeak — botão de PTT maior](https://community.teamspeak.com/t/larger-push-to-talk-button-for-road-construction-workers-and-business-use/64796), [Apple WWDC22 — Push to Talk](https://developer.apple.com/videos/play/wwdc2022/10117/)
