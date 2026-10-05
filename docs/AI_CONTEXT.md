# AI_CONTEXT
Objetivo: marketplace estilo Mercado Livre (pt-BR/BRL), competição com prazo curto.
Stack: React+Vite+TS+Tailwind3 | Express+TS+Prisma5+Postgres16 | pnpm monorepo.
Regras: dinheiro em centavos; FastSoft só na fase final e server-side; nunca simular
pagamento; nunca copiar código/ativos do ML; não trocar a stack.
Fase atual: branch `ingressos` — ETAPA 2+3 bloco 1 concluído (modelo+API de eventos,
sessões, ofertas e reservas; pedido por reserva com taxa 10%). Blocos 2–5 pendentes.
API: GET /api/v1/health · /products (q,page,limit,sort,category) · /products/:slug · /categories
· /cart (+ /cart/items CRUD) · /auth/register|login|logout|me · /addresses (GET,POST,DELETE /:id)
· /shipping/options?zipCode= (citação de frete pelo carrinho do cookie)
· /orders (POST com header Idempotency-Key; GET paginado; GET/:code; POST/:code/cancel)
· /payments (POST com Idempotency-Key + rate limit; GET/:id com reconsulta) · /webhooks/fastsoft
  (público, verificado por reconsulta ao provedor) — contratos em docs/API_REFERENCE.md e docs/FASTSOFT.md

## FASE 1 — correções preservadas (não reverter)
1. `ProductVariant.createdAt` existe no schema (service ordena variantes por ele).
2. `formatBRL` normaliza o espaço inseparável (U+00A0/U+202F) do Intl do Node 22.
3. ESLint: `argsIgnorePattern: '^_'` (Express 4 exige `_next` no error handler).

## FASE 2 — Design System
Tokens (única fonte de verdade: `frontend/tailwind.config.js` — nada de hex nos componentes):
- Cores semânticas: `background` `surface` `foreground` `muted-foreground` `border` e
  `primary` (#3483FA, hover #2968C8) `secondary` (#FFE600) `success` (#00A650)
  `warning` `destructive` `info` — cada cor de status tem `soft` (fundo claro) e
  `soft-foreground` (texto) para Alert/Badge. Marca legada mantida: `ml.*`, `ink.*`, `page`, `line`.
- Tipografia: `text-display h1 h2 h3 h4 body body-small caption label` (fonte Inter).
- Sombras: `shadow-card` `shadow-card-hover` `shadow-elevated`. Raio padrão 6px.
- Espaçamento: escala padrão do Tailwind; seções de página usam `py-8 md:py-12`.

Componentes:
- `components/layout/Container`: container global (max-w-[1200px], px-4 sm:px-6 lg:px-8).
- `components/ui/`: Button (primary/secondary/outline/ghost/destructive/link × sm/md/lg/icon,
  prop `loading`), Input, Select, Checkbox, Radio (label/helperText/error/disabled),
  Badge (default/success/warning/destructive/info/outline), Card + Header/Title/Description/
  Content/Footer, Skeleton + SkeletonText, Alert (info/success/warning/error),
  Separator, Breadcrumb (recebe `{label, href?}[]`), EmptyState, ErrorState.
- `components/ecommerce/`: ProductCard (+ ProductCardSkeleton; dados = ProductCardData),
  CategoryCard, Price (SEMPRE via formatBRL/discountPercent de `lib/format` — nunca
  formatar preço fora de lá), ProductImage (lazy, skeleton de loading, fallback de erro).

Convenções:
- Helper `cn()` (`lib/cn.ts`) para juntar classes condicionais.
- Showcase visual em `/design` (rota de referência, não é página de negócio).
- Estados visuais: focus = ring-2 ring-primary + ring-offset; disabled = opacity-50;
  loading = spinner border-current ou Skeleton; hover = sutil (shadow/translate-y-0.5).
- Animações ≤200ms; `prefers-reduced-motion` desativa tudo (globals.css).
- Acessibilidade: foco visível global, alt em imagens, aria-label quando necessário,
  role=alert em erro, labels associados por id, mobile-first (320/768/1024/1440).

## FASE 3 — Header
- `components/layout/Header.tsx` (sticky top-0 z-40, h-16, bg-surface, border-b border-line)
  + `icons.tsx` (SVGs inline decorativos, aria-hidden fixo). Renderizado globalmente no App.
- Desktop ≥lg: logo "marketplace" (2 tons, link /) · nav Home/Categorias/Ofertas (NavLink,
  aria-current) · busca · favoritos · carrinho. Tablet ≥md: sem nav-links (usa hamburger).
  Mobile <md: ☰ + logo + carrinho (favoritos some <sm).
- Busca: Enter/botão navega para `/search?q=<termo>` (rota do catálogo da FASE 5 — NÃO é
  /products, que não tem página e cairia no 404). Placeholders de nav: Categorias → /search,
  Ofertas → /search?sort=price_asc. Sem autocomplete (fase futura).
- Menu mobile: painel w-80 direita + overlay (clicável), fecha em X, ESC, clique em link e
  overlay; trava scroll do body; foco vai ao botão fechar; animate-slide-in-right (200ms).
- ÚNICA mudança no Design System: `Input` ganhou prop opcional `inputClassName` (para o
  ícone dentro do campo de busca) — retrocompatível, sem mudança visual nos usos existentes.
- Testes: `Header.test.tsx` via renderToStaticMarkup (sem jsdom/testing-library — zero deps
  novas); interações (menu/ESC) validadas manualmente no navegador.

## FASE 4 — Home
- `pages/Home.tsx` na rota `/` (HomeStub removido de `pages/stubs.tsx`). Título via document.title.
- 2 requests apenas: `GET /categories` (raízes, mostra até 8) e `GET /products?limit=20`
  (mais vendidos). Destaques = items[0..4]; Ofertas = `pickOffers(items, 4)` de `lib/home.ts`
  (produtos com discountPercent > 0, ordenados por maior desconto; se vazio, a seção não renderiza).
- Categoria navega para `/search?category=<slug>` (contrato da API: filtro por slug).
- Hero: h1 + CTA (Button → /search) + colagem 2×2 com 2 imagens reais de produtos
  (progressiva — enquanto carrega mostra Skeleton) + 2 tiles de marca (bg-primary/bg-secondary).
  Hero NÃO depende de API para aparecer.
- Seções: hero → categorias → destaques → ofertas (condicional) → benefícios (4, institucional)
  → CTA final (painel bg-primary + Button secondary). Loading com Skeleton/ProductCardSkeleton
  por seção; erro com ErrorState + refetch por seção (uma seção falha não derruba as outras);
  empty com EmptyState quando sem dados.
- Testes: `Home.test.tsx` — estado de dados/erro semeado no cache do React Query
  (setQueryData / QueryCache.build com status 'error' + client com enabled:false no teste de
  erro, pois o resultado otimista do useQuery no render estático simula refetch).

## FASE 5 — Catálogo (/search)
- `pages/Search.tsx` — ÚNICA página de catálogo (busca + categoria + ofertas); URL é a fonte
  da verdade via useSearchParams (q, category, sort, page). Refresh/back/forward preservam filtros.
- Utilitários em `lib/home.ts`: `CATALOG_PAGE_SIZE` (12), `buildCatalogParams` (monta a query
  do contrato real), `findCategoryName`, `linkableCategories` (folhas da árvore).
- Contrato REAL de GET /products: q, category (slug EXATO), sort (relevance|price_asc|
  price_desc|newest), page, limit (1–50) → { items, total, totalPages }. IMPORTANTE: o seed só
  tem produtos em categorias FOLHA — raízes retornam 0. Por isso: sidebar mostra raízes como
  agrupamentos (não clicáveis) e folhas como filtros; a Home usa `linkableCategories` (mudança
  mínima documentada da FASE 4).
- queryKey ['products', 'catalog', { q, category, sort, page }] (1 request por mudança);
  categorias usam ['categories'] (cache compartilhado com a Home).
- Sort select com os 4 valores do contrato. Paginação real (Anterior/Próxima + "Página X de Y",
  reset de page ao mudar filtro). "Limpar filtros" só com filtro ativo → /search.
- Mobile: botão Filtros abre drawer (mesmo padrão do menu do Header: overlay, ESC, foco no X,
  scroll lock, fecha ao navegar). Toolbar com flex-wrap (evita overflow em 375px).
- Título/SEO dinâmicos: `Busca: q | Marketplace`, `Categoria | Marketplace`, `Catálogo | Marketplace`.
- Test util compartilhado: `src/test/query-test-utils.ts` (seedErrorState, agora aceita erro custom).

## FASE 6 — Página de Produto (/product/:slug)
- `pages/Product.tsx`: breadcrumb real da API → galeria (thumbs verticais à esquerda no desktop,
  fileira com scroll-x no mobile) → info (vendidos, título, rating) → purchase box sticky
  (condição, Price lg + parcelamento, chips de variante com aria-pressed, estoque, QuantitySelector,
  frete grátis ou "frete no checkout", Comprar agora + Adicionar ao carrinho, Favoritar/Compartilhar)
  → Descrição → Informações (marca/condição) → Produtos relacionados (mesma categoria via
  /products?category=&limit=5, excluindo o próprio produto; seção some se vazio).
- Helpers novos em `lib/home.ts`: `ProductDetail` (tipo), `variantAttributeGroups`, `clampQuantity`.
- queryKey ['product', slug] com retry:false (404 é permanente); relacionados ['products','related',slug].
- 404 → EmptyState "Produto não encontrado" + Voltar (detectado via ApiClientError.status === 404).
- GRID BLOWOUT: filhos de grid com imagens precisam `min-w-0` (375px estourava 32px);
  fileira Favoritar/Compartilhar usa flex-wrap (1024px estourava 4px). Thumbs mobile: overflow-x-auto.
- Carrinho: botões mostram Alert "Carrinho em breve" (integração real é a FASE 7). Favoritar é
  estado LOCAL apenas; Compartilhar usa navigator.share → fallback clipboard ("Link copiado!").
- Parcelamento: deriva de `installments()` de lib/format (12x sem juros para >= R$150, teto —
  regra documentada no próprio format.ts). Vendedor/perguntas/avaliações detalhadas: sem dados na
  API → não implementados (limitação registrada).
- Reference visual: mercadolivre.html NÃO existe no repo — visual seguiu os tokens ML das fases 1–2.

## FASE 7 — Carrinho
- Backend: `GET /api/v1/cart`, `POST /cart/items`, `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId`
  (`controllers/cart.controller.ts`, `services/cart.service.ts`, cookie `cart_token` httpOnly SameSite=Lax
  30d em `lib/cookies.ts` — leitura manual do header, escrita via res.cookie; ZERO dependências novas).
- Regras server-side: preço SEMPRE do banco (priceOverride ?? product.price); subtotal/lineTotal
  calculados no servidor; valida variante ativa + produto ativo + estoque (409 INSUFFICIENT_STOCK);
  quantidade inteira ≥1 (400 VALIDATION); mesma variante SOMA quantidade (upsert por
  @@unique(cartId, variantId)); item de outro carrinho → 404; carrinho criado automaticamente no
  primeiro POST, sem login.
- Payload do carrinho: { items: [{ id, variantId, quantity, unitPrice, lineTotal, stock,
  product: { slug, title, thumbnail, freeShipping, variantAttributes } }], subtotal, totalItems }.
- Frontend: `lib/cart.ts` (cartApi + CART_QUERY_KEY ['cart'] compartilhado por Header/PDP/Cart);
  `api.ts` ganhou patch/delete; `pages/Cart.tsx` (loading/empty/error/itens + resumo sticky +
  Finalizar compra → /checkout stub + Continuar comprando); QuantitySelector extraído de
  Product.tsx para `components/ui/QuantitySelector.tsx` (reuso PDP + carrinho).
- PDP: Adicionar ao carrinho → mutation real + Alert success com "Ver carrinho"; Comprar agora →
  adiciona e navega para /cart; erro (ex.: estoque) → Alert warning com a mensagem do servidor.
- Header: badge com totalItems (só quando > 0) alimentado pelo mesmo cache ['cart'].
- Cookie same-origin via proxy do Vite (dev). Em produção cross-origin será preciso
  credentials: 'include' no fetch + CORS com credentials (limitação registrada).

## FASE 8 — Autenticação
- Backend (`lib/auth.ts`, `controllers/auth.controller.ts`): POST /auth/register, /auth/login,
  /auth/logout, GET /auth/me. Senha com scrypt do node:crypto (`scrypt:salt:hash`), ZERO deps novas.
- Sessão: cookie `auth_token` httpOnly SameSite=Lax 30d com token assinado HMAC-SHA256
  (`userId.expiração.assinatura`, segredo em AUTH_SECRET do backend/.env). STATELESS: logout só
  expira o cookie no cliente (sem revogação server-side — limitação). /auth/me → 401 quando anônimo.
- Respostas de register/login/me retornam o usuário DIRETO ({id, name, email}) — mesmo formato;
  nunca hash/senha. Erro de login genérico (INVALID_CREDENTIALS 401). Email duplicado → 409.
- Frontend (`lib/auth.ts`): AUTH_QUERY_KEY ['auth','me'], fetchCurrentUser (401 → null),
  validateLoginForm/validateRegisterForm (puras, testadas). Páginas Login/Register com Input/Button/
  Alert do DS; register autentica automaticamente (API emite sessão no registro); login aceita
  ?redirect=/caminho (só paths relativos).
- MERGE DO CARRINHO no login/register (`mergeGuestCartForUser` em cart.service.ts): sem carrinho
  do usuário → vincula o carrinho de visitante; com carrinho do usuário → mescla somando por
  variante com clamp ao estoque e apaga o carrinho de visitante; cart_token passa a apontar para
  o carrinho do usuário. `getOrCreateCart` vincula userId e recupera o carrinho do usuário logado.
- Header: visitante → link "Entrar"; logado → "Olá, {primeiro nome}" + "Sair" (invalida auth e
  carrinho) — desktop e menu mobile. Logout NÃO limpa cart_token (carrinho continua no navegador).

## FASE 9 — Checkout
- Backend: `shipping.service.ts` (regras de frete server-side: região pelo 1º dígito do CEP —
  0-3 Sudeste, 4-6 N/NE, 7-9 S/CO; Normal grátis quando TODOS os itens do carrinho são
  frete grátis, Expressa sempre paga; prazos em dias úteis — hipótese de negócio documentada,
  como installments()); `address.controller.ts` (GET/POST/DELETE /addresses — exige sessão 401,
  validação 400 com fields por campo, UF na lista dos 27, CEP normalizado a dígitos, primeiro
  endereço nasce isDefault, novo isDefault desativa os demais, DELETE de próprio promove o mais
  recente; isolamento por userId — endereço alheio vira 404); `shipping.controller.ts`
  (GET /shipping/options?zipCode= usa o carrinho do cookie p/ saber se Normal sai grátis).
- Frontend: `lib/checkout.ts` (Address/ShippingQuote, addressApi/shippingApi, ADDRESSES_QUERY_KEY,
  shippingQueryKey(zip), validateAddressForm — MESMAS regras do servidor —, formatZipCode
  (máscara 00000-000), formatAddressStreetLine/CityLine, UFS compartilhada Select+validação).
- `pages/Checkout.tsx` substitui CheckoutStub (stub removido de stubs.tsx): portão de login para
  anônimo (Button ganhou prop `to` → renderiza Link com o mesmo visual; links levam
  ?redirect=/checkout); etapas 1 Endereço (radiogroup com botões reais role=radio + remover
  FORA do botão de seleção; seleção DERIVADA — padrão da API ou primeiro — funciona em SSR,
  state só sobrescreve escolha manual) → 2 Entrega (radios com Radio labelClassName novo;
  Normal padrão; preço Grátis em text-success) → 3 Pagamento (Alert info: próxima fase — sem
  CTA falso). Resumo sticky (lg:top-20) com itens, Produtos, Frete, Total.
- `ApiClientError` ganhou `fields?: Record<string,string>` (retrocompatível) — erros 400 do
  servidor mapeiam para os campos do formulário após validar no cliente.
- Estado: meQuery/cartQuery/addressesQuery com enabled quando logado; carrinho vazio →
  EmptyState; erros de cart/endereços/frete → ErrorState + retry INDEPENDENTES; remoção com
  feedback "Removendo…" (aria-live) e botão desabilitado.
- Register aceita ?redirect= (mesmo contrato do Login, só paths relativos).
- Testes: backend address.test.ts (7) + shipping.test.ts (4); frontend checkout.test.ts (7,
  funções puras) + Checkout.test.tsx (10, SSR). GOTCHA descoberto: queries com `enabled` por
  query IGNORAM enabled:false do client nos testes de erro — usar `retryOnMount: false` +
  `staleTime: Infinity` (erro semeado não é re-tentado no mount; dados semeados não refetcham).
- Verificado no navegador: fluxo completo anônimo→gate, form com máscara/validação, cotação
  Sudeste (Normal Grátis p/ item frete grátis, Expressa R$ 39,90), total atualizando,
  desktop 1440px e mobile 390px sem overflow (fullPage screenshot costura com header sticky —
  capturar por viewport).

## FASE 10 — Pedidos
- Backend (`services/order.service.ts`, `controllers/order.controller.ts`): POST /orders exige
  header Idempotency-Key (400 se ausente). ORDEM das validações: idempotência (mesma key + mesmo
  usuário → 200 pedido original; key de outro usuário → 409) → deliveryOption (400) → endereço
  (404 se de outro usuário) → carrinho ativo do usuário com itens (422 CART_EMPTY) → estoque
  (422 STOCK_INSUFFICIENT, fields por slug). Totais/frete recalculados do banco com
  shippingQuote(address.zipCode, flags de freeShipping); pedido + deleteMany(CartItems) +
  cart.status=converted na MESMA transação ($transaction com retry de code em colisão —
  revalidando a key idempotente dentro do catch).
- Code: `RD-` + 8 chars de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (randomBytes; sem I/O/0/1).
- Migrations desta fase: `order_cancelled_at` (Order.cancelledAt) e `order_item_created_at`
  (OrderItem.createdAt — ordena o snapshot na ordem do carrinho; criado com Date.now()+index
  dentro da transação para garantir asc).
- `getOrCreateCart` (cart.service) IGNORA carrinhos converted (por token e por usuário) — sem
  isso o primeiro POST /cart/items após um pedido reusaria o carrinho convertido.
- Frontend: `lib/orders.ts` (ordersApi com header Idempotency-Key via novo 3º param de api.post;
  ORDERS_QUERY_KEY ['orders'], ordersPageQueryKey(page), orderQueryKey(code);
  resolveIdempotencyKey(lease, signature, generate) — signature = endereço|opção|variantId:qty;
  orderStatusMeta, formatOrderItemAttributes, describeOrderError (stock/cart-empty/generic),
  ApiErrorLike). Checkout.tsx dividido: Checkout = AuthGate + CheckoutContent; etapa 3 Revisão
  com confirmMutation (loading 'Confirmando…', disabled sem endereço/entrega); sucesso →
  setQueryData(['cart'], vazio) + invalidate ['orders'] + navigate /checkout/pedido-recebido/:code.
- Páginas: OrderReceived (check verde + badge + alert honesto + resumo), Orders (lista paginada
  via ?page=, placeholderData para troca de página suave), OrderDetail (badge, cancelamento em
  dois passos inline — sem modal —, invalida lista ao cancelar). `AuthGate` (ui/AuthGate.tsx)
  substituiu o gate inline do Checkout e protege as 3 páginas novas (redirect = pathname+search
  encodados). Header: link "Meus pedidos" junto ao usuário (desktop) e no menu mobile.
- TESTE GOTCHA (novo): para semear 404, passe o erro certo ao seedErrorState —
  `new ApiClientError(msg, 'NOT_FOUND', 404)`; Error genérico cai no ErrorState genérico, não no
  EmptyState (o componente decide por instanceof/status).
- Formatação: formatDate/formatDateTime em lib/format (pt-BR; formatDateTime troca vírgula por
  " às").

## FASE 11 — Pagamento Pix (FastSoft)
- Contratos da FastSoft confirmados página a página (origem anotada em docs/FASTSOFT.md). NADA
  inventado: o que a doc não define (assinatura de webhook, formato normativo do pix.qrcode,
  sandbox) virou PENDENTE/risco. `pix.qrcode` no example é base64 PNG; frontend trata image/url/
  texto (PixQrCode em components/ecommerce/PixPaymentCard.tsx).
- `lib/fastsoft.ts`: AUTH `Basic base64("x:"+key)`; NUNCA logar chave/payload (erros só
  status); `isConfigured()` existe para o .env.example/dev.
- `services/payment.service.ts`: validatePayer (CPF com dígito verificador — mesma regra em
  frontend/lib/payer.ts), createPayment (idempotência → método → pedido 404/422 → Pix ativo não
  expirado devolvido → FastSoft 502 genérico), syncPaymentFromProvider (amount/externalRef
  conferidos) e applyTransition (guarda ALLOWED_TRANSITIONS; PAID = transação
  payment+order+estoque; falta de estoque → needsReview, não perde o pagamento).
- Webhook: dedupe ANTES da consulta (SHA-256 do corpo em PaymentEvent.dedupeKey); unknown → 200;
  FastSoft falha → 502. Rate limit em memória (PAYMENTS_RATE_LIMIT, default 10/min; testes
  forçam 1000 via env no topo do arquivo de teste).
- Frontend: lib/payments.ts (paymentRefetchInterval pausa em aba oculta; secondsUntil/countdown;
  pixQrCodeKind), lib/payer.ts (máscaras+DV), PixPaymentCard (form pré-preenchido, reusado em
  pedido-recebido e detalhe), páginas PixPayment (/payments/:id, polling 4s, PAID → redireciona)
  e CheckoutSuccess (/checkout/success?order= só com API confirmando paid).
- TESTE GOTCHA: no arquivo de teste, mockar `../src/lib/fastsoft` com vi.mock ANTES dos imports;
  e NÃO nomear função do controller igual à do service importada (sombreamento vira recursão —
  use alias `createPaymentService`). Cada teste de criação usa pedido PRÓPRIO (Pix ativo é
  devolvido e atrapalha quem reusa o pedido).
- Cobrança real: PROIBIDA sem autorização explícita do usuário (sem sandbox!). Validação no
  navegador foi feita com FASTSOFT_SECRET_KEY="" no processo do dev server.

## BRANCH `ingressos` — ETAPA 2+3, BLOCO 1 (tema ingressos)
- Modelos novos: Event → EventSession → Offer (ticketType=área, ticketCategory=modalidade,
  sellerId nulo=plataforma, quantity) → Reservation (TTL 10 min avaliado por timestamp — sem cron).
  Disponível = quantity − reservas ativas não expiradas.
- **Reserva com lock**: `SELECT ... FOR UPDATE` na oferta dentro de $transaction (com cast
  `::uuid` — $queryRaw manda text e `uuid = text` quebra!). offerId não-uuid → 404 (sem tocar o banco).
- POST /orders com DOIS fluxos: `{addressId, deliveryOption}` (carrinho, inalterado) ou
  `{reservationId, receiptEmail?}` → ticketSnapshot JSONB (evento/sessão/tipo/categoria/
  organizador/preços/taxa/total/receiptEmail). **Taxa de serviço = 10% ARREDONDADA
  (Math.round) — SERVICE_FEE_RATE em order.service**. Order: shippingAddress agora Json? ;
  OrderItem.variantId agora String? ; Order + ticketSnapshot/reservationId.
- PAID no payment.service: branch por ticketSnapshot — reserva ativa → converted + decremento
  da oferta; reserva expirada → valida disponibilidade agora, baixa se couber, senão
  paid+needsReview. Itens sem variantId são pulados no fluxo de produto.
- FastSoft para pedido de ingresso: items[].externalRef = offerId (variantId é null);
  shipping address com `?.` (shippingAddress nulo em ticket).
- Seed reescrito: 12 eventos FICTÍCIOS (Time Azul x Time Verde etc.), 17 sessões, 75 ofertas
  (sessões sem oferta → Indisponível; "Evento de teste Pix" R$ 1 mantido como EVENTO).
  Produtos físicos NÃO são mais semeados (deletes mantidos). api.test.ts agora cria fixture própria.
- Limpeza do seed: `pnpm seed` (destrutivo) ou DELETE na ordem Reservation → Offer →
  EventSession → Event. Ver comentário no topo do seed.ts.
