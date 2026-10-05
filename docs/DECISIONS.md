# DECISIONS — Premissas e escolhas do marketplace

Registro das decisões que NÃO são óbvias pelo código. Datas em 2026.

## FASES 1–8 (resumo do que já estava decidido)
- Dinheiro SEMPRE em centavos (INTEGER); formatação BRL exclusivamente no frontend (`lib/format`).
- `ProductVariant.createdAt` existe (ordenar variantes); `formatBRL` normaliza U+00A0/U+202F do
  Intl do Node 22; ESLint `argsIgnorePattern: '^_'` (Express 4).
- Sessão stateless: cookie `auth_token` assinado com HMAC-SHA256 (`userId.expiração.assinatura`,
  AUTH_SECRET); logout só expira o cookie (sem revogação server-side — aceito por enquanto).
- Parcelamento: 12x sem juros para >= R$ 150 (hipótese de negócio em `lib/format.installments`).
- Recurso de outro usuário = 404 (nunca 403): carrinho, endereço e pedido seguem o mesmo contrato.
- Carrinho convertido (`status: "converted"`) é IGNORADO por `getOrCreateCart` — novas compras
  começam um carrinho ativo novo; o cookie antigo é substituído no próximo POST.
- Pagamento: nunca simular; FastSoft só na fase final e server-side.

## FASE 9 — Checkout
- Frete (`shipping.service`, server-side): região pelo 1º dígito do CEP — 0–3 Sudeste,
  4–6 Norte/Nordeste, 7–9 Sul/Centro-Oeste. Normal grátis SOMENTE quando todos os itens do
  carrinho são freeShipping; Expressa sempre paga. Prazos em dias úteis fixados por região
  (hipótese de negócio documentada, pronta para trocar por transportadora real).
- `Button` ganhou prop `to` (renderiza `<Link>` com o mesmo visual) e `Radio` ganhou
  `labelClassName` — extensões retrocompatíveis do DS, sem novo componente.
- `ApiClientError.fields` carrega erros 400 por campo do servidor.
- Register aceita `?redirect=` igual ao Login (só paths relativos — nunca URL absoluta).

## FASE 10 — Pedidos
- **Código do pedido**: `RD-` + 8 chars de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I/O/0/1),
  aleatório via `node:crypto` (não sequencial), retry em colisão.
- **Idempotência**: `Idempotency-Key` obrigatória no POST /orders. Mesma key + mesmo usuário →
  **200 com o pedido original** (frontend trata 200 e 201 como sucesso). Mesma key de OUTRO
  usuário → 409 IDEMPOTENCY_CONFLICT (a unique é global no schema — mantivemos, keys são UUID).
  O frontend gera UMA key por tentativa: mudou endereço/entrega/carrinho → nova key; retry após
  erro de rede → mesma key (`resolveIdempotencyKey` em `lib/orders.ts`).
- **Estoque**: na criação do pedido só VALIDA (422 STOCK_INSUFFICIENT com fields por slug).
  Decremento fica para a confirmação do pagamento (fase futura). Cancelamento não devolve estoque
  (nada foi decrementado).
- **Pedido de outro usuário → 404** (mesmo contrato de carrinho/endereço; documentado aqui por
  ser a escolha explícita entre 403/404).
- **Snapshots**: itens (OrderItem.productSnapshot por linha: productId, slug, title, thumbnail,
  attributes), endereço (Order.shippingAddress) e entrega (Order.deliveryOption: id, label,
  descrição/prazo, região e preço praticado) são gravados no pedido — histórico imune a mudança
  de preço/remoção de produto.
- **Conversão do carrinho**: pedido + limpeza dos CartItems + `cart.status = "converted"` na
  MESMA transação Prisma.
- **Tela pós-confirmação**: rota `/checkout/pedido-recebido/:code` (escolha documentada; a
  alternativa era reaproveitar /orders/:code com flag). Sem botão de pagar — pagamento é a fase
  seguinte.
- **OrderItem.createdAt**: campo adicionado (migration) para preservar a ordem dos itens do
  carrinho no snapshot (mesmo precedente do ProductVariant.createdAt). `Order.cancelledAt`
  também entrou na mesma fase (duas migrations pequenas).
- **`X-Requested-With`**: a instrução da fase citava um "padrão atual" de exigir esse header;
  ele NUNCA existiu no código. Decisão: não inventar — auth continua por cookie httpOnly +
  `Idempotency-Key` no POST /orders.

## FASE 11 — Pagamento Pix (FastSoft)
- **Client único**: `backend/src/lib/fastsoft.ts` — frontend nunca fala com o provedor; timeout
  15s; erros normalizados (FastSoftError, status 0 = rede); chave NUNCA logada; payload nunca
  logado.
- **pix.qrcode**: o example da doc vem como base64 de imagem PNG (não como EMV copia-e-cola) e a
  doc não normatiza o formato → o frontend trata imagem base64, URL e texto (QR local com
  react-qr-code, ~20 kB SVG, dependência justificada em FASTSOFT.md).
- **Webhook sem assinatura**: a FastSoft não documenta nenhuma. Confiança vem da RECONSULTA
  autenticada (`Obter Transação`) conferindo amount + externalRef antes de qualquer transição;
  dedupe por SHA-256 do corpo em PaymentEvent. Consulta falha → 502 (provedor reenvia);
  divergência/unknown → 200 ignorado (reenvio não mudaria nada).
- **Guarda de estados**: tabela de transições literal da doc; nada regride; PAID só avança para
  REFUNDED/IN_PROTEST/CHARGEDBACK. Status FastSoft gravados normalizados (toUpperCase) no
  Payment; Order usa pending/paid/cancelled.
- **PAID**: baixa de estoque atômica (`stock >= qty`) na mesma transação; se faltar estoque,
  pedido fica `paid` com `needsReview=true` (pagamento nunca perdido) + log de revisão manual.
- **Um Pix vivo por pedido**: pagamento WAITING_PAYMENT/PROCESSING não expirado é devolvido em
  POST /payments; expirado libera novo. REFUSED/CANCELED também liberam.
- **CPF**: enviado formatado à FastSoft, persistido SÓ mascarado (`***.982.247-**`);
  requestPayload/responsePayload ficam nulos.
- **Rate limit**: 10/min/usuário em POST /payments (PAYMENTS_RATE_LIMIT ajusta; testes usam 1000).
- **postbackUrl**: só enviado com PUBLIC_API_URL (HTTPS público); dev confirma por polling
  (GET /payments/:id reconsulta após 10s de obsolescência).
- **Rota de sucesso**: `/checkout/success?order=RD-XXXX` renderiza sucesso SÓ com
  `Order.status === 'paid'` confirmado pela API.
- Migration escrita à mão (`payment_pix_fields`) com `migrate deploy`: o `migrate dev` recusa
  ambiente não-interativo quando há warnings (unique em coluna nullable); SQL idêntico ao do
  Prisma.
### Descobertas do teste real (FASE 11, 05/10/2026)
- `externalRef` raiz → 400 whitelist; vínculo via `metadata` (JSON string). Conferência de
  identidade no webhook/sync aceita `externalRef` OU `metadata.orderCode`.
- CPF/telefone enviados só com dígitos (mascarados dos examples não são exigidos).
- Valor mínimo prático = acima da taxa do gateway (R$ 1,00 recusado com "O valor das taxas é
  igual ou superior ao valor da transação"); produto de teste do seed = R$ 10,00.
- `pix.qrcode` real = EMV copia e cola (example da doc era base64 PNG ilustrativo).
- Log do 502 inclui status HTTP + mensagem do provedor com sequências de 5+ dígitos mascaradas.
