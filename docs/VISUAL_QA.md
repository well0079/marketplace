# VISUAL_QA — tema ingressos (branch `ingressos`)

QA visual comparado com docs/DESIGN_AUDIT.md e docs/REFERENCE_SCREENS.md.
Data: 2026-10-05 · Viewports: 1366×900, 390×844, 360×740 · Screenshots em `.reference/` (ignorado pelo git).

| Tela | Desktop (1366) | Mobile (390/360) | Status |
|---|---|---|---|
| `/event/:slug` | hero desfocado + card de imagem + intervalo de datas + "N datas" + cards de data com bloco (dia roxo/mês/dia semana) e seta primária; card inteiro clicável → sessão | sem overflow; cards empilhados legíveis | ✅ OK |
| `/event/:slug/session/:id` | hero + card pequeno + título + organizador/data 🏢📅 + pills + banner outlined (env) + card "Selecione o ingresso" (2 selects) + ofertas por menor preço + Vender preto + Guia de transferência + Descrição 4 seções | sem overflow em 390 e 360; selects/ofertas em coluna | ✅ OK |
| `/signup` (3 passos) | barra de progresso roxa "N de 3", formulário 320px, ícone no topo, títulos centrados; demo mostra banner com código; off pula o passo; checklist de senha ao vivo; termos no rodapé | sem overflow | ✅ OK |
| `/login` | consistente com o cadastro; olho na senha; "Esqueci a senha (em breve)"; redirect de volta funcionando | sem overflow | ✅ OK |
| `/search` | grid de EventCard via /events?q=, vazio/erro tratados | 2 colunas no mobile | ✅ OK (mínimo; filtros completos pendentes) |
| `/tickets` | faixa legal + TopBar 56px + abas segmentadas + vazio/OrderCards + rodapé completo | sem overflow | ✅ OK |
| `/terms` · `/privacy` | texto demonstrativo marcado | — | ✅ OK |
| 404 (shell ingressos) | estado vazio com volta para a home | — | ✅ OK |

## Divergências restantes (documentadas, intencionais/pendentes)
1. ✅ RESOLVIDO no bloco 4a: TopBar agora usa as medidas auditadas (**78px desktop / 66px mobile**).
2. **Fonte do corpo**: páginas novas usam `font-hanken`; títulos Lexend — igual ao audit. A faixa legal usa a fonte base (nano) como na referência.
3. **Hero do evento**: usamos **gradiente por categoria** (placeholders) no lugar da imagem desfocada real — a estrutura (largura total, blur/grayscale, card sobreposto) segue a referência.
4. **Shell duplo eliminado**: o Header do marketplace não aparece mais nas rotas de ingressos (`usesTicketShell` no App.tsx); o marketplace antigo segue funcionando nas rotas dele sem links cruzados.
5. **BottomNav** não renderizada ainda (reservada; o shell já reserva o padding) — entra junto com o produto final.

## Fluxos validados no navegador (dados reais)
- Cadastro completo em **modo demo** (banner com código) e **modo off** (pula o passo) ✓
- Logout pelo dropdown → visitante clica "Comprar" → **/login?redirect=<sessão>** → volta à sessão após entrar ✓
- Login por celular ✓ · dropdown do header (Esc devolve foco) ✓ · /tickets com estado vazio e abas ✓
