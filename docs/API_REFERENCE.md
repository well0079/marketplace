# API_REFERENCE — Marketplace

Base: `/api/v1` · Autenticação e carrinho por cookies httpOnly (`auth_token`, `cart_token`) ·
Valores monetários em **centavos** (INTEGER) · Erros: `{ error: { code, message, fields? } }`

## Catálogo (público)
- `GET /health` → `{ status, database }` (503 DATABASE_DOWN se o banco cair)
- `GET /products?q&page&limit&sort&category` → `{ items, page, limit, total, totalPages }`
  · sort: `relevance|price_asc|price_desc|newest` · category = slug EXATO (folhas têm produtos)
- `GET /products/:slug` → produto completo (404 se não existir)
- `GET /categories` → árvore de categorias

## Carrinho (visitante ou logado; carrinho criado no primeiro POST)
- `GET /cart` → `{ items[], subtotal, totalItems }` (nunca falha por falta de cookie)
- `POST /cart/items` `{ variantId, quantity }` → 201 carrinho (409 INSUFFICIENT_STOCK, 404 variante)
- `PATCH /cart/items/:itemId` `{ quantity }` → carrinho (409 estoque, 404 item de outro carrinho)
- `DELETE /cart/items/:itemId` → carrinho
- Regras: preço SEMPRE do banco (priceOverride ?? price); mesma variante soma (upsert)

## Autenticação
- `POST /auth/register` `{ name, email, password }` → 201 usuário `{id,name,email}` (409 EMAIL_IN_USE,
  400 com fields) · já emite sessão e mescla o carrinho de visitante
- `POST /auth/login` `{ email, password }` → usuário (401 genérico INVALID_CREDENTIALS)
- `POST /auth/logout` → `{ ok: true }` (só expira o cookie; stateless)
- `GET /auth/me` → usuário ou 401 UNAUTHENTICATED

## Endereços (sessão obrigatória)
- `GET /addresses` → lista do usuário (padrão primeiro, mais recente depois)
- `POST /addresses` `{ recipient, zipCode, street, number, complement?, district, city, state, label?, isDefault? }`
  → 201 endereço (CEP normalizado a 8 dígitos; 400 VALIDATION com fields por campo; primeiro nasce
  isDefault; novo isDefault desativa os demais)
- `DELETE /addresses/:id` → `{ ok: true }` (404 se não existir OU for de outro usuário; remover o
  padrão promove o mais recente)

## Frete (público; usa o carrinho do cookie)
- `GET /shipping/options?zipCode=01310100` → `{ zipCode, region, options: [{ id: standard|express,
  label, description (prazo em dias úteis), price }] }` (400 se CEP inválido)
- Regras (`shipping.service`): região pelo 1º dígito do CEP (0–3 Sudeste, 4–6 N/NE, 7–9 S/CO);
  `standard` grátis quando TODOS os itens do carrinho são freeShipping; `express` sempre paga

## Pedidos (sessão obrigatória)
- `POST /orders` — headers: `Idempotency-Key` (obrigatória, 400 se ausente)
  body: `{ addressId, deliveryOption: "standard" | "express" }` (valores de preço/total no body são
  IGNORADOS)
  → 201 pedido criado / 200 pedido original (mesma key + mesmo usuário) ·
  `{ code, status: "pending", paymentPending: true, subtotal, shippingCost, discount, total,
     deliveryOption: { id, label, description, region, price }, shippingAddress: {...snapshot},
     items: [{ variantId, productId, slug, title, thumbnail, attributes, unitPrice, quantity,
     lineTotal }], createdAt, cancelledAt: null }`
  Erros: 409 IDEMPOTENCY_CONFLICT (mesma key, outro usuário) · 404 NOT_FOUND (endereço de outro
  usuário ou inexistente) · 422 CART_EMPTY · 422 STOCK_INSUFFICIENT (fields por slug do produto)
  · 400 deliveryOption inválida
  Efeitos: carrinho ativo → status `converted` + itens removidos (mesma transação do pedido).
  Estoque é apenas VALIDADO (decremento será no pagamento).
- `GET /orders?page&limit` → `{ items: [{ code, status, total, createdAt, firstItemImage,
  itemsCount }], page, limit, total, totalPages }` (itemsCount = soma das quantidades; só os
  pedidos do usuário, mais recentes primeiro; limit 1–50, default 10 no frontend / 20 na API)
- `GET /orders/:code` → detalhe completo (404 se não existir OU for de outro usuário — escolha
  documentada em DECISIONS.md)
- `POST /orders/:code/cancel` → pedido cancelado (`status: "cancelled"`, `cancelledAt` preenchido);
  só quando `pending` (422 INVALID_STATUS caso contrário); não mexe em estoque.
  Status de Order: `pending` | `paid` | `cancelled` (paid/shipped/delivered reservados; needsReview
  marca pedido pago com estoque insuficiente para revisão manual).

## Pagamentos (sessão obrigatória; provedor FastSoft — ver docs/FASTSOFT.md)
- `POST /payments` — headers: `Idempotency-Key` (obrigatória). Rate limit 10/min por usuário (429
  RATE_LIMITED; ajustável via PAYMENTS_RATE_LIMIT).
  body: `{ orderCode, method: "pix", payer: { name, document (CPF), phone } }`
  → 201 criado / 200 pagamento existente (mesma key, ou Pix ativo não expirado):
  `{ paymentId, status, paid, orderCode, amount, pix: { qrCode, qrImageUrl, expiresAt } }`
  Status do pagamento = status normalizado da FastSoft: WAITING_PAYMENT, PROCESSING, IN_ANALYSIS,
  AUTHORIZED, PAID, REFUNDED, CHARGEDBACK, IN_PROTEST, REFUSED, CANCELED.
  Erros: 400 VALIDATION (CPF dígito verificador, telefone, method ≠ pix) · 404 pedido de outro
  usuário · 422 INVALID_STATUS (pago/cancelado) · 502 PAYMENT_PROVIDER_ERROR.
  Regras: amount/itens/frete sempre do snapshot do pedido; CPF guardado só mascarado; um pedido
  não tem dois Pix ativos; expirado libera novo.
- `GET /payments/:id` → mesmo payload (só do dono; 404 para terceiros). Se o status local ainda
  estiver ativo e a última checagem tiver >10s, reconsulta a FastSoft (fallback do webhook).

## Webhook FastSoft (público)
- `POST /webhooks/fastsoft` — envelope `{ type, objectId, data: { id, status, amount, ... } }`.
  NÃO confia no payload: grava bruto (dedupe SHA-256), localiza o pagamento e RECONSULTA a
  FastSoft conferindo amount/externalRef antes de aplicar a transição (guarda de estado, nunca
  regride). PAID → baixa de estoque atômica. Consulta falhando → 502 (reenvio). Malformado → 400.
  Respostas sempre sem detalhes internos.

## Formato do código do pedido
`RD-` + 8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I/O/0/1), aleatórios via
`node:crypto` (não sequenciais), com retry em colisão de unique.
