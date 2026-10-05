# FASTSOFT — Integração de pagamento (FASE 11, somente Pix)

Provedor: **FastSoft** (credencial emitida via Unipay, que revende a FastSoft).
Doc oficial: https://developers.fastsoftbrasil.com/docs/intro/getting-started
Client isolado em `backend/src/lib/fastsoft.ts` — o frontend NUNCA fala com o provedor.

## Confirmado na doc (com página de origem)

| Item | Valor | Página de origem |
|---|---|---|
| Base URL | `https://api.fastsoftbrasil.com` (só produção; **não há sandbox**) | intro/getting-started |
| Auth | `Authorization: Basic base64("x:" + FASTSOFT_SECRET_KEY)`; chave formato `sk_...`, exibida **uma única vez** no painel (Configurações → Chave de API) | intro/authentication |
| Criar transação | `POST /api/user/transactions` — valores em centavos | api/user-transaction-controller-create-transaction |
| Campos do request | `amount` (obrigatório), `currency` ("BRL"), `paymentMethod` ("PIX"), `customer{name,email,phone,document{number,type}}`, `shipping{fee,address{street,streetNumber,complement,zipCode,neighborhood,city,state,country}}`, `items[{title,unitPrice,quantity,tangible,externalRef}]` (obrigatório), `pix{expiresInDays}`, `postbackUrl`, `metadata`, `traceable`, `ip`, `externalRef`, `card`/`installments` (cartão), `boleto`, `subMerchant` | página Criar Transação (Request; o exemplo tem o typo "externaRef" no customer — usamos `externalRef` do schema) |
| Obter transação | `GET /api/user/transactions/:id` (id UUID) | api/user-transaction-controller-get-transaction |
| Response (200) | `{ data: {id, amount, status, externalRef, paidAt, paymentMethod, pix{qrcode, url, expirationDate}, refusedReason, items, customer, shipping, ...}, status, message, error }` (lido na aba **Example (auto)** de Obter/Criar Transação — o schema da aba "Schema" mostra `data` como objeto opaco) | idem |
| `pix.qrcode` | No **example da doc** é base64 de imagem PNG; **na prática (transação real de teste, 05/10/2026) vem como string EMV copia-e-cola** (`00020101...br.gov.bcb.pix...`). O frontend trata os três formatos (base64, URL, texto→QR local com `react-qr-code`) | Example (auto) + teste real |
| Webhook | `POST` no `postbackUrl` (SÓ HTTPS público) com `{ type: "transaction", objectId, url, data: {id, status, amount, externalRef, pix{qrcode, expirationDate}, paidAt, ...} }` | webhook/transaction |
| Assinatura do webhook | **Não documentada** (a página não menciona HMAC/secret) | webhook/transaction |
| Reembolso | `POST /api/user/transactions/:id/refund` (só de PAID) — FORA DO ESCOPO desta fase | api/user-transaction-controller-refund-transaction |
| Teste de conexão | `GET /api/user/wallet/balance` | intro/getting-started |

### Mapa de status (normalizado com toUpperCase — a doc mistura caixas)

Status da FastSoft gravados **como estão** (normalizados) em `Payment.status`:

| FastSoft | Interno | Efeito no pedido |
|---|---|---|
| WAITING_PAYMENT / PROCESSING | aguardando (ativos) | `pending` |
| IN_ANALYSIS / AUTHORIZED | aguardando/autorizado (ativos) | `pending` |
| **PAID** | pago | `paid` + baixa de estoque |
| REFUNDED / CHARGEDBACK / IN_PROTEST | pós-pago | `paid` (tratamento futuro) |
| REFUSED / CANCELED | não concluído | segue `pending` — libera novo Pix |

Transições válidas (tabela da doc, aplicadas com guarda — **nunca regridem**):
PROCESSING→AUTHORIZED/REFUSED/CANCELED/PAID · WAITING_PAYMENT→PAID/CANCELED/REFUSED/IN_ANALYSIS ·
IN_ANALYSIS→PAID/CANCELED/REFUSED/AUTHORIZED · AUTHORIZED→PAID/CANCELED/REFUSED ·
PAID→REFUNDED/IN_PROTEST/CHARGEDBACK · IN_PROTEST→REFUNDED/CHARGEDBACK.

## Decisões de implementação

- **Nunca confiar no webhook**: persistimos o evento bruto (`PaymentEvent`, dedupe por SHA-256 do
  corpo), localizamos o pagamento por `providerTransactionId` e **reconsultamos** a transação na
  FastSoft (`Obter Transação`) conferindo `amount === Payment.amount` e `externalRef === código do
  pedido`. Só então a transição é aplicada. Consulta falhando → **502** (a FastSoft reenvia);
  payload divergente → ignorado com 200 (reenvio não mudaria nada); transação desconhecida → 200.
- **Idempotência**: `Idempotency-Key` obrigatória em POST /payments; mesma key + mesmo usuário
  devolve o pagamento original; além disso, pagamento ativo (WAITING_PAYMENT/PROCESSING) **não
  expirado** é devolvido — nunca dois Pix vivos. Pix expirado libera novo.
- **Confirmação PAID** em uma transação: `Payment.status=PAID` + `Order.status=paid` + baixa
  atômica de estoque (`stock >= quantidade` por variante). Se faltar estoque, o pagamento NÃO é
  perdido: pedido fica `paid` com `needsReview=true` + log de revisão manual.
- **Rate limit** em POST /payments: 10/min por usuário (ajustável por `PAYMENTS_RATE_LIMIT`), 429.
- **Sincronização por polling**: GET /payments/:id reconsulta o provedor se o status local ainda
  estiver ativo e a última checagem tiver mais de 10s (`lastSyncedAt`) — é o caminho de dev, onde
  webhook não chega.
- **Dados sensíveis**: CPF vai à FastSoft formatado e é guardado SÓ mascarado
  (`***.982.247-**` em `Payment.payerDocumentMasked`); `requestPayload`/`responsePayload` ficam
  nulos (nunca persistir payload com CPF); chave nunca em log/código/git; erros do provedor
  viram 502 genérico no controller.
- **QR**: `react-qr-code` (~20 kB, SVG puro, zero deps) — necessário só quando o `qrcode` vier
  como texto EMV; base64 PNG/URL renderizam como `<img>`.
- **Rota de sucesso**: `/checkout/success?order=RD-XXXX` renderiza sucesso SOMENTE se a API
  confirmar `Order.status === 'paid'`.

## PENDENTE (não implementado nesta fase)

- Cartão de crédito, boleto (campos existem na doc; método travado em "pix").
- Reembolso (`POST .../refund`), 3DS/tokenização de cartão, cashout, subMerchant.
- Assinatura/verificação criptográfica de webhook (a FastSoft não documenta nenhuma).
- Compensação de `REFUNDED`/`CHARGEDBACK` no pedido (hoje só muda o Payment).
- Envio de e-mail/notificação na confirmação.

## Descobertas do teste real (05/10/2026 — transações de R$ 1,00/R$ 10,00, nenhuma paga)

1. **`externalRef` no nível RAIZ do payload é rejeitado**: HTTP 400
   `{"message":["property externalRef should not exist"]}` (validation pipe com whitelist).
   O vínculo pedido↔transação vai em `metadata` (string JSON `{"orderCode":"RD-..."})`; os
   `items[].externalRef` e `customer.externalRef` são aceitos.
2. **CPF e telefone SÓ com dígitos** (`52998224725`, `11987654321`) — os formatos mascarados dos
   examples (`000.000.000-00`, `(11) 98765-4321`) não são exigência da API.
3. **Valor mínimo prático**: transação com valor igual/inferior à taxa do gateway é RECUSADA com
   HTTP 400 `{"message":"Transação recusada...","error":{"refusedReason":"...O valor das taxas é
   igual ou superior ao valor da transação."}}`. R$ 1,00 não funciona; o produto de teste do seed
   usa R$ 10,00.
4. **`pix.qrcode` real = EMV copia e cola** (ver item da tabela acima) — o frontend renderiza QR
   local e oferece "Copiar código Pix".
5. Erros HTTP 400 de recusa chegam com `data.id`/`data.status: "refused"` — a transação É criada
   no provedor em estado refused (não há cobrança).

## Riscos conhecidos

1. **Sem sandbox**: qualquer transação criada com a chave real é uma cobrança REAL de Pix.
2. **Webhook sem assinatura**: mitigado pela reconsulta autenticada + conferência de
   amount/externalRef antes de qualquer transição.
3. **Webhook exige HTTPS público** (`PUBLIC_API_URL`): em dev/local o postback não é enviado e a
   confirmação depende do polling da tela do Pix.
4. **Formato do `pix.qrcode`** não é normativo na doc (só example base64 PNG) — o frontend cobre
   os três formatos; se a produção trouxer algo diferente, o caso cai em "texto" (QR local).
