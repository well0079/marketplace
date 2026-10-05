# DESIGN_AUDIT — buyticketbrasil.com (tema "ingressos")

Auditoria de referência visual feita em 2026-10-05 via navegador (1366×900 e 390×844),
lendo **valores computados** — nenhum arquivo CSS/JS/imagens do site foi baixado ou copiado.
Fonte dos tokens: declarações de `:root` do próprio site (160 variáveis capturadas).
Reimplementação em React + Tailwind com tokens nossos (namespaces `ticket.*`, `t-*`).
Screenshots em `.reference/` (ignorado pelo git, nunca commitado).

## 1. Variáveis de :root (valores reais medidos)

### Marca e semântica
| Variável | Valor | Uso |
|---|---|---|
| `--color-primary` | `#5C4BF9` | ação primária, links, ativos |
| `--color-primary-press` | `#4A3BD6` | estado pressionado |
| `--color-primary-deep` | `#241542` | roxo profundo (fundos) |
| `--color-primary-soft` | `#EEECFE` | fundo de chip/tile |
| `--color-primary-tint` | `#5C4BF90A` | hover sutil |
| `--color-primary-outline` / `-soft` | `#5C4BF980` / `#5C4BF940` | anéis de foco |
| `--color-on-primary` | `#FFFFFF` | texto sobre primary |
| `--color-accent` / `-soft` | `#0FA968` / `#E2F6EE` | confirmação/êxito |
| `--color-success` | `#0B7F4F` | texto de sucesso |
| `--color-caution` / `-soft` / `-text` | `#FFB100` / `#FFF9EE` / `#4D370F` | aviso amarelo |
| `--color-warn` / `-soft` | `#C2410C` / `#FBEADF` | aviso laranja |
| `--color-danger` / `-soft` | `#DC2626` / `#FBE5E5` | erro |
| `--color-text` | `#14151A` | texto principal |
| `--color-muted` / `--color-faint` | `#6B7280` / `#9AA0AA` | texto secundário/terciário |
| `--color-border` / `--color-outline` / `--color-hairline` | `#E4E6EB` / `#C9CDD3` / `#EFF1F4` | bordas |
| `--color-surface` / `-muted` / `2` | `#FFFFFF` / `#F1F2F4` / `#EDEFF2` | superfícies |
| `--color-scrim` / `-strong` | `#14151A80` / `#14151ABF` | modal |
| `--color-glass` / `-soft` / `-strong` | `#00000038` / `#0000001F` / `#0006` | overlays sobre imagem |
| `--color-pix` / `-soft` | `#32BCAD` / `#DDF1EF` | identidade Pix |
| `--background` / `--foreground` | `#FFFFFF` / `#171717` | base |
| `--brand-*` (deep-purple, green, orange, pink, red, sport-green, vibrant-purple, yellow…) | paleta de categorias | tiles/segundos planos |

### Raios
`--radius-bar` 2px · `--radius-control` 10px · `--radius-tile` 12px · `--radius-circle` 15px ·
`--radius-card` 16px · `--radius-sheet` 22px · `--radius-pill` 999px

### Sombras
`--shadow-card` `0 1px 6px -3px #00000040` · `--shadow-row` `0 2px 8px #0000000F` ·
`--shadow-panel` `0 3px 10px 0 #14141F0F` · `--shadow-hover` `0 12px 28px #14151A24` ·
`--shadow-dialog` `0 18px 40px #14151A24`

### Layout
`--desktop-header-height` **78px** (mobile medido: 66px) · container `max-width: 1200px`
(padding `0 8px 24px`) · QuickFilters `max-width: 800px` · BottomNav mobile **80px**

## 2. Escala tipográfica (tokens de :root)

| Token | size | weight | line-height | letter-spacing | Uso |
|---|---|---|---|---|---|
| `--text-amount` | 46px | 700 | 52px | -1px | valores de pagamento |
| `--text-price-l` | 30px | 600 | 36px | -0.3px | preço de destaque |
| `--text-display` | 28px | 700 | 34px | -0.42px | título de página (medido em evento: Hanken 28px/700) |
| `--text-h1` | 24px | 700 | 30px | -1.5px | h1 |
| `--text-total` | 20px | 700 | 24px | -0.1px | total |
| `--text-h2` | 20px | 600 | 26px | -1px | h2 (medido: **Lexend** 20px/600) |
| `--text-title` | 18px | 600 | 24px | -0.5px | título de card |
| `--text-body-strong` | 16px | 600 | 22px | -0.32px | corpo com ênfase |
| `--text-body` | 16px | 400 | 22px | — | corpo (inputs também 16px) |
| `--text-label-strong` | 14px | 700 | 18px | — | botões (medido: botão primário 14px/700, padding 0 18px, radius 10px) |
| `--text-label` | 14px | 600 | 18px | — | rótulos |
| `--text-body-s` | 14px | 400 | 20px | — | corpo pequeno |
| `--text-caption-strong` | 12px | 500 | 16px | — | metas |
| `--text-caption` | 12px | 400 | 16px | — | metas |
| `--text-eyebrow` | 12px | 600 | 16px | **0.96px** | sobretítulo |
| `--text-legal` | 11px | 500 | 16px | — | legal |
| `--text-micro` | 11px | 600 | 14px | -0.44px | badges |
| `--text-nano` | 10px | 400 | 13px | — | legenda mínima (BottomNav) |

### Fontes (confirmado no computed style)
- **Hanken Grotesk** — corpo, inputs, botões, h1 de evento, chips
- **Lexend** — títulos de seção (h2), títulos de marca
- **Sora** — numérico/preços (aplicamos em total/preço/amount)
- Implementado via `@fontsource/hanken-grotesk` (400/600/700), `@fontsource/lexend` (600/700),
  `@fontsource/sora` (600/700).

## 3. Componentes (medidos)

| Componente | Medição | Estados |
|---|---|---|
| **TopBar** (desktop) | 78px alto, padding 16px 8px, fundo `#584CF4`-family (roxo da marca), gap 10px, busca embutida | sticky no mobile com saudação "Boa noite 👋 / Acesse sua conta" + botão claro `Anunciar` |
| **BottomNav** (mobile) | 80px, 5 itens (Descobrir, Pesquisar, Ingressos, Conversas, Entrar), fundo branco, item ativo roxo | ativo = primary |
| **SearchBar** | pista 236px no header desktop (expande no mobile, largura total), ícone lupa à esquerda, radius control | foco com anel primary-outline |
| **Chip** | fundo `#EEECFE`, texto `#5C4BF9`, radius 10px, padding 8px | selecionado = primary sólido |
| **CategoryTile** | 58×80 (mobile), ícone em círculo primary-soft, legenda 12px | hover scale ~1.15 (sutil) |
| **ScrollRail** | flex, **gap 16px**, overflow-x auto, **scroll-snap x** | sem scrollbar visível |
| **EventCarousel** | cards ~224px de largura, setas circulares nas laterais (desktop) | snap por card |
| **EventCard** | pôster 4:3 radius 16px + badge pill escuro + título 2 linhas + metas 12px + preço | hover: shadow-hover |
| **EventRow** | thumb quadrada radius 12px + título/datas + preço à direita | hover: shadow-row |
| **SectionHeader** | ícone emoji + título Lexend 20px/600 + trailing "Ver tudo →" | — |
| **OfferRow** | card com preço grande (price-l), original riscado, selo -% accent | — |
| **StepRail** | passos numerados circulares 24px, completo=accent, ativo=primary | — |
| **CountdownPill** | pill `--color-glass-strong` + texto branco + dígitos Sora | sobre imagem |
| **DeadlineMeter** | trilha hairline 1.5px + preenchimento accent, arredondado | — |
| **OrderSummary** | card com linhas muted + total em total-token | — |
| **OrderCard** | código + StatusPill + título + total | — |
| **StatusPill** | pill 999, tons soft por status | confirmado/pendente/cancelado/expirado |
| **Field** | input 16px radius 10px, foco anel primary | erro vermelho |
| **Modal** | scrim `#14151A80`, sheet radius 22px, shadow-dialog (mobile bottom-sheet) | — |
| **IconBadge** | pill com ícone + texto (soft/solid) | — |
| **IconButton** | 40×40 círculo, borda hairline | hover soft |
| **LanguageToggle** | pill segmentado (PT/EN), ativo com sombra row | — |

## 4. Breakpoints e grid
- Mobile-first; quebras observadas em **768px** (busca sobe para o header, nav inferior some)
  e desktop com container **1200px** centralizado (padding lateral 8px).
- Grid de cards: carrossel horizontal (não grid) no desktop e mobile.
- Header: 78px desktop / 66px mobile; BottomNav fixo só no mobile (80px).

## 5. Animações e movimento
- `--motion-hover-duration` **0.18s**, `--motion-hover-ease` **cubic-bezier(.2, 0, .2, 1)**
- `--motion-hover-scale` 1.15 (tiles) e `--motion-hover-scale-subtle` 1.02 (cards)
- Transições curtas em hover/focus; respeita `prefers-reduced-motion` (implementamos com
  `motion-safe:` nas escalas e duration ≤ 200ms).

## 6. Mapeamento para o projeto
- Tokens: `ticket.*` (cores), `t-*` (raios, sombras, escala tipográfica) em `tailwind.config.js`.
- Componentes: `frontend/src/components/ingressos/{Layout,Controls,Cards}.tsx` (22 componentes).
- Showcase: rota `/design-ingressos`.
- Fontes via @fontsource (justificativa: pedido explícito para conferir Hanken Grotesk/Lexend/Sora;
  pacotes oficiais, zero JS extra).
