# CHANGELOG

## ETAPA 2+3 — bloco 3 (branch `ingressos`): conta, shell, /tickets e rodapé
- Backend (3a): cadastro em 3 passos (`signup/start|verify|complete`) com token HMAC de 30 min
  e desafio em banco (código hashado, 5 tentativas, tempo constante); modos de verificação
  off/demo/sms (501 real); celular E.164 único, CPF mascarado+hash com pepper; login aceita
  celular; rate limits por env; `/auth/me` com cpfMasked+isSeller; `/orders?kind=ticket` e
  `activePaymentId` no detalhe. Migration `user_account_fields` + SignupChallenge.
- Frontend (3b): shell próprio nas rotas de ingressos (faixa legal, alerta por env, TopBar 56px
  com BrandLogo/buscab/dropdown acessível, rodapé "Compra Garantida"), `/signup` em 3 passos
  (máscaras, checklist de senha ao vivo, demo banner), `/login` (e-mail ou celular), `/search`
  mínimo, `/tickets` com abas por teclado + `/tickets/:code` (com "Aguardando transferência"),
  `/sellers/verify` (em breve), 404 temático, Comprar/Vender com auth-gate e redirect seguro.
- Testes: backend +19 (auth-signup: 3 modos, tentativas/expiração, duplicidade genérica,
  login por celular, usuário antigo); frontend +14 com Testing Library (wizard nos 3 modos,
  checklist, dropdown por teclado, abas, redirect, 404). Suíte: 253 testes.
- Validação no navegador: cadastro demo/off, logout, login por celular, Comprar anônimo →
  login → volta à sessão, /tickets com estado vazio; 390px sem overflow. VISUAL_QA.md criado.

## FASE 11 — Pagamento Pix FastSoft: cobrança, webhook verificado e confirmação (2026-10-05)
- Backend: client isolado `lib/fastsoft.ts` (Basic auth `x:CHAVE`, timeout 15s, sem logar
  chave/payload; contratos lidos na doc oficial — criar/obter transação, webhook). `POST /payments`
  (Idempotency-Key obrigatória; rate limit 10/min ajustável por PAYMENTS_RATE_LIMIT; valida CPF
  com dígito verificador e telefone; só pedido `pending` do próprio usuário; nunca dois Pix
  ativos — pagamento ativo não expirado é devolvido; amount/itens/frete sempre do snapshot do
  pedido; CPF enviado formatado e guardado SÓ mascarado). `GET /payments/:id` reconsulta o
  provedor quando o status local está ativo e obsoleto (>10s). `POST /webhooks/fastsoft`
  (público, sem assinatura na doc): persiste evento bruto com dedupe SHA-256, RECONSULTA a
  FastSoft conferindo amount/externalRef antes de aplicar transições com guarda (nunca regridem;
  tabela da doc). PAID em uma transação: Payment=paid + Order=paid + baixa atômica de estoque;
  estoque insuficiente → pedido `paid` com `needsReview` (pagamento nunca perdido).
  Migrations: campos Pix/paidAt/masked/lastSyncedAt + providerTransactionId/dedupeKey únicos +
  `Order.needsReview` (aplicadas com `migrate deploy`).
- Frontend: bloco "Pagar com Pix" no pedido-recebido e no detalhe (dados do pagador pré-
  preenchidos, máscara + validação de CPF/telefone no cliente); tela `/payments/:id` com QR
  (base64 PNG/URL/texto EMV via `react-qr-code`, ~20 kB SVG justificado), copia e cola,
  contagem de expiração e polling 4s (pausa em aba oculta, para ao pagar); `/checkout/success`
  SÓ confirma com a API (`status === 'paid'`); badge "Pago" nos pedidos; `OrderStatus` ganhou
  `paid`.
- Testes: +14 no backend com client 100% mockado (`payments.test.ts` — criação/valor do banco/
  payload à FastSoft/CPF mascarado no banco, idempotência, Pix ativo/expirado, webhook com
  divergência/dedupe/regressão/estoque/502, 404 de terceiro; 68 total) e +15 no frontend
  (máscaras/DV de CPF, polling/QR/countdown, bloqueio do /checkout/success; 145 frontend).
  Suíte geral: 213 testes.
- Verificação no navegador SEM COBRANÇA REAL (backend rodou com FASTSOFT_SECRET_KEY vazia):
  bloco Pix com nome pré-preenchido, CPF inválido bloqueado no cliente, erro 502 do provedor
  tratado com Alert, /checkout/success bloqueada para pedido pending, mobile 390px ok.
- Docs: `FASTSOFT.md` criado (confirmado com página de origem, mapa de status, pendências e
  riscos: sem sandbox, webhook sem assinatura, HTTPS obrigatório para postback).

## FASE 10 — Pedidos: criação idempotente, snapshot, lista e detalhe (2026-10-04)
- Backend: `POST /orders` (header `Idempotency-Key` obrigatório; body `{ addressId, deliveryOption }`;
  totais e frete SEMPRE recalculados no servidor — valores do cliente ignorados; snapshot de
  itens/endereço/entrega gravado no pedido; estoque apenas validado com 422 STOCK_INSUFFICIENT
  por slug; pedido + limpeza do carrinho + `converted` na mesma transação; mesma key + mesmo
  usuário devolve o pedido original 200, key de outro usuário 409), `GET /orders` paginado
  (resumo com firstItemImage/itemsCount, mais recentes primeiro), `GET /orders/:code` e
  `POST /orders/:code/cancel` (só pending; 404 para pedido de outro usuário). Código do pedido:
  `RD-` + 8 chars sem I/O/0/1. Migrations: `Order.cancelledAt` e `OrderItem.createdAt`
  (preserva a ordem dos itens do snapshot).
- Carrinho: `getOrCreateCart` ignora carrinho `converted` (novas compras começam carrinho novo —
  necessário após a conversão em pedido).
- Frontend: etapa 3 do checkout virou **Revisão** (itens com atributos, endereço, entrega,
  totais + botão "Confirmar pedido" com estado "Confirmando…"); Idempotency-Key por tentativa
  (`resolveIdempotencyKey`: mudou endereço/entrega/carrinho → nova key; retry de rede → mesma
  key); erros mapeados (estoque com link para o carrinho, carrinho vazio, genérico com retry).
  Telas novas: `/checkout/pedido-recebido/:code` (pedido recebido — aguardando pagamento, sem
  botão de pagar), `/orders` (lista paginada com badge de status) e `/orders/:code` (detalhe com
  cancelamento em dois passos). `AuthGate` extraído (usado por checkout/pedidos); "Meus pedidos"
  no Header (desktop + menu mobile); `api.post` aceita headers extras; `formatDate/formatDateTime`
  em lib/format.
- Testes: backend 16 novos em `order.test.ts` (54 total) — totais/frete do servidor, snapshot
  imune a mudança de preço, idempotência (ausente/repetida/conflito entre usuários), carrinho
  vazio, estoque, endereço alheio, cancelamento e isolamento por usuário; frontend +29 (lib 12,
  Orders/OrderDetail/OrderReceived 12, Checkout de Revisão — 105 total; geral 159).
- Verificado no navegador: registro com redirect, carrinho mesclado, checkout completo
  (endereço → Expressa → revisão → confirmar), duplo clique no "Confirmar pedido" não duplica
  (2º clique bloqueado pelo loading + idempotência server-side), carrinho zerado no Header após
  o pedido, pedido recebido, lista, detalhe, cancelamento em dois passos; mobile 390px e 360px
  sem overflow.
- Docs: `API_REFERENCE.md` e `DECISIONS.md` criados (não existiam); TODO atualizado.

## FASE 9 — Checkout: endereços + frete real (2026-10-04)
- Backend: `GET/POST /addresses` + `DELETE /addresses/:id` (sessão obrigatória; validação 400 com
  fields; CEP normalizado; primeiro endereço nasce padrão; isolamento por usuário) e
  `GET /shipping/options?zipCode=` — regras de frete server-side em `shipping.service.ts`
  (região pelo 1º dígito do CEP em 3 faixas; Normal grátis só quando TODO o carrinho é
  frete grátis; Expressa sempre paga; prazos em dias úteis). Zero dependências novas,
  zero migrations (Address já existia no schema).
- Frontend: `/checkout` real substitui o stub — portão de login p/ anônimos (redirect de volta),
  etapa 1 endereço (selecionar/adicionar/remover com validação client espelhando o servidor e
  erros 400 mapeados por campo via novo `ApiClientError.fields`), etapa 2 entrega (citação por
  região com Normal/Expressa, Grátis em verde), etapa 3 pagamento (Alert informativo — FASE 10),
  resumo sticky com total = produtos + frete. `lib/checkout.ts` novo (API + validações puras +
  máscara de CEP); `Button` ganhou prop `to` (renderiza Link com o mesmo visual); `Radio` ganhou
  `labelClassName`; Register aceita `?redirect=` como o Login.
- Testes: +11 no backend (address 7, shipping 4 — 38 total) e +17 no frontend (lib 7, página 10 —
  76 total; suíte geral 114). Descoberta registrada: em testes SSR, queries com `enabled`
  por-query ignoram `enabled:false` do client — usar `retryOnMount:false` + `staleTime:Infinity`
  para semear estado de erro.
- Verificação manual no navegador (desktop 1440/mobile 390): gate, formulário com máscara,
  cotação Sudeste com Normal grátis (carrinho 100% frete grátis), total atualizando ao trocar
  para Expressa, estados de erro/empty isolados por seção.

## FASE 8 — Autenticação + vínculo do carrinho (2026-10-04)
- Backend: `/auth/register|login|logout|me` com scrypt (node:crypto, zero deps) e sessão em cookie
  `auth_token` httpOnly assinado por HMAC-SHA256 (AUTH_SECRET no .env; stateless — logout expira
  o cookie, sem revogação server-side). Usuário direto no corpo de register/login/me; erros
  genéricos no login (401), email duplicado 409, validação 400 com fields.
- Carrinho: `mergeGuestCartForUser` no login/registro — vincula o carrinho de visitante ou mescla
  no carrinho do usuário (soma por variante com clamp ao estoque) e aponta o cart_token para o
  carrinho do usuário; `getOrCreateCart` agora vincula userId e recupera o carrinho do logado.
- Frontend: `/login` e `/register` reais (validação client pura testada + erros do servidor);
  Header com "Entrar" / "Olá, {nome}" + "Sair" (desktop e menu mobile).
- Testes: 9 novos no backend (auth.test.ts inclui vinculação e merge com clamp de estoque);
  frontend 59→... com Login/Register/Header-sessão. Suíte total: 86 testes.
- Correções durante a fase: resposta de login/register mudou para usuário direto no corpo
  (formato inconsistente quebrava o Header — crash `user.name.split`); GET sem cookie nunca falha.

## FASE 7 — Carrinho (2026-10-04)
- Backend: 4 endpoints de carrinho (`GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`)
  com cookie `cart_token` httpOnly (30 dias), carrinho de convidado criado automaticamente,
  preços/subtotal sempre do banco, validação de variante/estoque (409), soma de quantidade na
  re-add (upsert), isolamento por carrinho (404). Zero dependências novas (cookie lido manualmente).
- Frontend: `/cart` real (loading/empty/error/itens, quantity com clamp ao estoque, remover,
  resumo sticky, Finalizar compra → stub de checkout, Continuar comprando); PDP com mutation real
  (sucesso com "Ver carrinho" ou navegação no Comprar agora; erro → Alert com mensagem do servidor);
  Header com badge de totalItems (cache compartilhado ['cart']); `QuantitySelector` extraído para ui/.
- Testes: 11 novos no backend (cart.test.ts, dados próprios isolados) + 6 no frontend (Cart.test.tsx);
  Header.test ganhou QueryClientProvider. Suíte total: 76 testes.
- Descobertas: FK CartItem.variantId é RESTRICT (cleanup de teste precisa remover cartItems antes);
  cada request sem cookie cria carrinho novo (testes de acumulação precisam reusar o cookie).

## FASE 6 — Página de Produto (2026-10-04)
- `/product/:slug` de stub para PDP completa: breadcrumb real, galeria com thumbs (switch), preço com
  desconto e parcelamento (12x ≥ R$150, regra em `lib/format.ts`), variantes com preço/estoque reais,
  quantidade com clamp 1..estoque, frete grátis, purchase box sticky, favoritar (local), compartilhar
  (Web Share API → clipboard), descrição, informações, produtos relacionados (mesma categoria).
- 404 de produto → EmptyState com "Voltar"; erro de API → ErrorState com retry.
- Correções de layout descobertas no navegador: `min-w-0` nos filhos do grid (grid blowout em 375px),
  flex-wrap na fileira de ações (1024px), scroll-x nas thumbs mobile.
- Testes: 13 novos em `Product.test.tsx` (SSR + helpers). Suíte: 44 testes (7 backend + 37 frontend).

## FASE 5 — Catálogo (2026-10-04)
- `/search` único para busca/categoria/ofertas com estado na URL (q, category, sort, page).
- Descoberta: filtro de categoria é por slug exato e produtos só existem em folhas → sidebar com
  raízes como agrupamentos; Home usa `linkableCategories`.
- Paginação real, drawer de filtros mobile, título/SEO dinâmicos. 11 testes novos.

## FASE 4 — Home (2026-10-04)
- Home real com 2 requests (`/categories`, `/products?limit=20`): hero, categorias, destaques,
  ofertas (`pickOffers`), benefícios, CTA final, estados por seção. 8 testes novos.

## FASE 3 — Header (2026-10-04)
- Header global sticky: logo, navegação, busca (Enter → `/search?q=`), favoritos/carrinho,
  menu mobile acessível. `Input` ganhou `inputClassName`. 5 testes novos.

## FASE 2 — Design System (2026-10-04)
- Tokens semânticos (cores/tipografia/sombras), Container, ui/ (Button, Input, Select, Checkbox,
  Radio, Badge, Card, Skeleton, Alert, Separator, Breadcrumb, EmptyState, ErrorState), ecommerce/
  (Price, ProductImage, ProductCard, CategoryCard), showcase em `/design`.

## FASE 1 — Fundação (2026-10-04)
- Monorepo pnpm (React 18 + Vite 5 + Tailwind 3.4 | Express 4 + Prisma 5 + PostgreSQL), API de
  catálogo, seed (16 categorias, 31 produtos), testes/build/lint. Correções preservadas:
  `ProductVariant.createdAt`, `formatBRL` (U+00A0), eslint `argsIgnorePattern: '^_'`.
