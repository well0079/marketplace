# CHANGELOG

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
