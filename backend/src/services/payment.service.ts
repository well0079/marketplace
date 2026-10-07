import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { formatZipCode, hashCpf, isValidCpf, maskCpf, onlyDigits } from '../lib/cpf'
import * as fastsoft from '../lib/fastsoft'

// Pagamentos Pix via FastSoft: criação idempotente, sincronização com o provedor
// (fallback do webhook), guarda de transições de status e confirmação PAID com
// baixa de estoque. Valores sempre em centavos, sempre do banco.

const PIX_EXPIRES_IN_DAYS = 2
const SYNC_MIN_INTERVAL_MS = 10_000
const ACTIVE_STATUSES = ['WAITING_PAYMENT', 'PROCESSING']
const FINAL_PAID_STATUSES = ['PAID', 'REFUNDED', 'CHARGEDBACK', 'IN_PROTEST']

// Tabela de transições confirmada na doc (docs/webhook/transaction) — nenhum status
// regride; PAID só avança para REFUNDED/IN_PROTEST/CHARGEDBACK
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PROCESSING: ['AUTHORIZED', 'REFUSED', 'CANCELED', 'PAID'],
  WAITING_PAYMENT: ['PAID', 'CANCELED', 'REFUSED', 'IN_ANALYSIS'],
  IN_ANALYSIS: ['PAID', 'CANCELED', 'REFUSED', 'AUTHORIZED'],
  AUTHORIZED: ['PAID', 'CANCELED', 'REFUSED'],
  PAID: ['REFUNDED', 'IN_PROTEST', 'CHARGEDBACK'],
  IN_PROTEST: ['REFUNDED', 'CHARGEDBACK'],
}

// A doc mistura minúsculo/maiúsculo ("paid" no webhook, "PAID" na consulta)
export function normalizeStatus(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase()
}

// Mensagem do provedor para o log: mascara qualquer sequência de 5+ dígitos
// (CPF/telefone nunca aparecem inteiros em log)
function sanitizeProviderMessage(message: string): string {
  return message.replace(/\d{5,}/g, '***').slice(0, 1000)
}

export type PaymentPayload = {
  paymentId: string
  status: string
  paid: boolean
  orderCode: string
  amount: number
  pix: { qrCode: string | null; qrImageUrl: string | null; expiresAt: string | null } | null
}

type PaymentWithOrder = {
  id: string
  status: string
  amount: number
  providerTransactionId: string | null
  pixQrCode: string | null
  pixExpiresAt: Date | null
  paidAt: Date | null
  order: { code: string; userId: string; status: string }
}

export function toPaymentPayload(payment: PaymentWithOrder): PaymentPayload {
  return {
    paymentId: payment.id,
    status: payment.status,
    paid: FINAL_PAID_STATUSES.includes(payment.status),
    orderCode: payment.order.code,
    amount: payment.amount,
    pix: {
      qrCode: payment.pixQrCode,
      qrImageUrl: null,
      expiresAt: payment.pixExpiresAt ? payment.pixExpiresAt.toISOString() : null,
    },
  }
}

// Validação pura (testada) dos dados do pagador
export function validatePayer(payer: unknown): {
  document: string
  phone: string
  fields: Record<string, string>
} {
  const body = (payer ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const document = onlyDigits(body.document)
  const phone = onlyDigits(body.phone)
  if (document.length !== 11 || !isValidCpf(document)) fields.document = 'Informe um CPF válido.'
  if (phone.length < 10 || phone.length > 11) fields.phone = 'Informe um telefone com DDD.'
  return { document, phone, fields }
}

type CreatePaymentInput = {
  user: { id: string; email: string; name: string; phone: string | null; cpfHash: string | null }
  orderCode: string
  method: string
  payer: { document: string; phone: string }
  idempotencyKey: string
  ip: string
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<{ payload: PaymentPayload; created: boolean }> {
  // 1) Idempotência: mesma key + mesmo usuário devolve o pagamento original (sem nova cobrança)
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { order: true } })
  if (existing) {
    if (existing.order.userId !== input.user.id) {
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já está em uso.')
    }
    return { payload: toPaymentPayload(existing), created: false }
  }

  if (input.method !== 'pix') {
    throw new ApiError(400, 'VALIDATION', 'Método de pagamento inválido.', { method: 'Somente Pix nesta fase.' })
  }

  // 2) Pedido do próprio usuário
  const order = await prisma.order.findFirst({
    where: { code: input.orderCode, userId: input.user.id },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Pedido não encontrado')
  if (order.status === 'paid') throw new ApiError(422, 'INVALID_STATUS', 'Este pedido já está pago.')
  if (order.status !== 'pending') {
    throw new ApiError(422, 'INVALID_STATUS', 'Este pedido não está aguardando pagamento.')
  }

  // 3) Pagamento ativo não expirado: devolve o existente (nunca dois Pix vivos)
  const active = await prisma.payment.findFirst({
    where: { orderId: order.id, status: { in: ACTIVE_STATUSES }, pixExpiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { order: true },
  })
  if (active) return { payload: toPaymentPayload(active), created: false }

  // 4) Transação na FastSoft — amount/itens/frete SEMPRE do snapshot do pedido
  const ticket = (order.ticketSnapshot ?? null) as { offerId?: string } | null
  // O pagador é o dono da conta: nome e telefone vêm da conta; o CPF do formulário
  // precisa corresponder ao CPF cadastrado (mesmo pepper no hash). Nunca guardado/logado.
  const accountCpfHash = input.user.cpfHash
  if (accountCpfHash && hashCpf(input.payer.document) !== accountCpfHash) {
    throw new ApiError(422, 'CPF_MISMATCH', 'O CPF informado não corresponde ao CPF da sua conta. Confira e tente novamente.')
  }

  const address = (order.shippingAddress ?? null) as Record<string, string> | null
  const postbackUrl = process.env.PUBLIC_API_URL ? `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/webhooks/fastsoft` : undefined
  const transaction = await fastsoft
    .createTransaction({
      amount: order.total,
      currency: 'BRL',
      paymentMethod: 'PIX',
      customer: {
        // nome e telefone vêm da CONTA (o formulário não manda)
        name: input.user.name,
        email: input.user.email,
        // CPF e telefone SÓ com dígitos (ajuste pós-teste real; a validação do
        // provedor rejeitou os valores formatados dos examples)
        document: { number: input.payer.document, type: 'CPF' },
        phone: input.user.phone ?? input.payer.phone,
      },
      shipping: {
        fee: order.shippingCost,
        address: {
          street: address?.street ?? '',
          streetNumber: address?.number ?? '',
          complement: address?.complement ?? '',
          zipCode: formatZipCode(address?.zipCode ?? ''),
          neighborhood: address?.district ?? '',
          city: address?.city ?? '',
          state: address?.state ?? '',
          country: 'BR',
        },
      },
      items: order.items.map((item) => ({
        title: (item.productSnapshot as { title: string }).title,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        // ingresso não tem variante: externalRef do item = oferta (ticketSnapshot)
        tangible: true,
        externalRef: item.variantId ?? ticket?.offerId ?? 'ticket',
      })),
      pix: { expiresInDays: PIX_EXPIRES_IN_DAYS },
      // A API real REJEITA externalRef no nível raiz (400 "property externalRef
      // should not exist" — validation pipe com whitelist); o vínculo pedido↔
      // transação vai em metadata (string JSON, como no example da doc)
      metadata: JSON.stringify({ orderCode: order.code }),
      traceable: true,
      ip: input.ip,
      ...(postbackUrl ? { postbackUrl } : {}),
    })
    .catch((error) => {
      // Log com status HTTP e mensagem do provedor (mascarada) para diagnóstico;
      // a chave e o payload NUNCA vão para o log. Frontend recebe 502 genérico.
      const fsError = error as fastsoft.FastSoftError
      const detail = fsError.providerMessage
        ? sanitizeProviderMessage(fsError.providerMessage)
        : 'provedor sem detalhes'
      console.error(`[fastsoft] falha ao criar transação do pedido ${order.code}: HTTP ${fsError.status ?? '?'} — ${detail}`)
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.')
    })

  const expiresAt = transaction.pix?.expirationDate
    ? new Date(transaction.pix.expirationDate)
    : new Date(Date.now() + PIX_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: 'fastsoft',
      providerTransactionId: transaction.id,
      method: 'pix',
      status: normalizeStatus(transaction.status) || 'WAITING_PAYMENT',
      amount: order.total,
      pixQrCode: transaction.pix?.qrcode ?? null,
      pixExpiresAt: Number.isNaN(expiresAt.getTime()) ? null : expiresAt,
      payerDocumentMasked: maskCpf(input.payer.document),
      lastSyncedAt: new Date(),
      idempotencyKey: input.idempotencyKey,
      // requestPayload/responsePayload ficam nulos: nunca persistir CPF completo nem payload bruto
    },
    include: { order: true },
  })

  return { payload: toPaymentPayload(payment), created: true }
}

export async function getPaymentForUser(
  userId: string,
  paymentId: string,
): Promise<PaymentPayload> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { userId: true, code: true, status: true } } },
  })
  // Mesmo contrato de pedidos/endereços: recurso de outro usuário é 404
  if (!payment || payment.order.userId !== userId) throw new ApiError(404, 'NOT_FOUND', 'Pagamento não encontrado')

  // Fallback do webhook: se ainda pendente e a última checagem é antiga, consulta o provedor
  if (ACTIVE_STATUSES.includes(payment.status)) {
    const stale = !payment.lastSyncedAt || Date.now() - payment.lastSyncedAt.getTime() > SYNC_MIN_INTERVAL_MS
    if (stale) {
      try {
        await syncPaymentFromProvider(payment.id)
      } catch (error) {
        console.error(`[fastsoft] sincronização do pagamento ${payment.id} falhou: ${(error as Error).message}`)
      }
      const fresh = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { order: { select: { userId: true, code: true, status: true } } },
      })
      if (fresh) return toPaymentPayload(fresh)
    }
  }
  return toPaymentPayload(payment)
}

// Consulta o provedor e aplica a transição com guarda de estado + verificação de
// amount/externalRef (nunca confiar só no que veio de fora)
export async function syncPaymentFromProvider(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { code: true, userId: true, status: true } } },
  })
  if (!payment || !payment.providerTransactionId) return

  const transaction = await fastsoft.getTransaction(payment.providerTransactionId)

  if (typeof transaction.amount !== 'number' || transaction.amount !== payment.amount) {
    console.error(`[fastsoft] divergência de valor no pagamento ${payment.id}: ignorado`)
    await prisma.payment.update({ where: { id: payment.id }, data: { lastSyncedAt: new Date() } })
    return
  }
  // Identidade da transação: casar EXCLUSIVAMENTE por metadata.orderCode (campo que
  // controlamos). O externalRef é GERADO PELA GATEWAY (descoberta de produção: ela
  // devolve um NSU próprio, ex. "JP7ZMGGWG54Z") e NÃO é critério de vínculo.
  let metadataOrderCode: string | undefined
  try {
    metadataOrderCode = (JSON.parse(String(transaction.metadata ?? '{}')) as { orderCode?: string }).orderCode
  } catch {
    /* metadata não-JSON → rejeita abaixo */
  }
  if (metadataOrderCode !== payment.order.code) {
    console.error(
      `[fastsoft] referência divergente no pagamento ${payment.id} (externalRef ${JSON.stringify(transaction.externalRef) ?? 'sem externalRef'}, metadata ${JSON.stringify(transaction.metadata ?? null)}): ignorado`,
    )
    await prisma.payment.update({ where: { id: payment.id }, data: { lastSyncedAt: new Date() } })
    return
  }

  await applyTransition(payment.id, normalizeStatus(transaction.status), transaction.paidAt ?? null)
}

// Guarda de estado: nunca regride; PAID só avança para REFUNDED/IN_PROTEST/CHARGEDBACK
export async function applyTransition(paymentId: string, nextStatus: string, paidAt?: string | null): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { items: true } } },
  })
  if (!payment) return

  if (payment.status === nextStatus) {
    await prisma.payment.update({ where: { id: payment.id }, data: { lastSyncedAt: new Date() } })
    return
  }
  const allowed = ALLOWED_TRANSITIONS[payment.status] ?? []
  if (!allowed.includes(nextStatus)) {
    console.error(`[pagamento] transição inválida ignorada: ${payment.status} → ${nextStatus} (${payment.order.code})`)
    return
  }

  if (nextStatus === 'PAID') {
    // UMA transação: pagamento pago + pedido pago + baixa atômica de estoque.
    // Se faltar estoque, o pagamento NÃO é perdido: pedido pago com flag de revisão manual.
    await prisma.$transaction(async (tx) => {
      let needsReview = false
      const ticket = (payment.order.ticketSnapshot ?? null) as
        | { kind?: string; offerId?: string }
        | null
      if (ticket?.kind === 'ticket' && ticket.offerId) {
        // ── Pedido de INGRESSO: converte a reserva e baixa a oferta ──
        // Reserva ativa e não expirada: converte e decrementa a oferta
        // (deixar de contar a reserva + baixar quantity mantém a disponibilidade consistente).
        // C1: quantity chegando a 0 → oferta e anúncio vinculados viram `sold`.
        const markSoldIfEmpty = async (offerId: string) => {
          const offer = await tx.offer.findUnique({ where: { id: offerId }, select: { quantity: true } })
          if (offer && offer.quantity <= 0) {
            await tx.offer.updateMany({ where: { id: offerId }, data: { status: 'sold' } })
            await tx.listing.updateMany({ where: { offerId }, data: { status: 'sold' } })
          }
        }
        const reservation = payment.order.reservationId
          ? await tx.reservation.findUnique({ where: { id: payment.order.reservationId } })
          : null
        if (reservation && reservation.status === 'active' && reservation.expiresAt > new Date()) {
          await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'converted' } })
          await tx.offer.update({
            where: { id: ticket.offerId },
            data: { quantity: { decrement: reservation.quantity } },
          })
          await markSoldIfEmpty(ticket.offerId)
        } else {
          // Reserva expirada/cancelada: valida a disponibilidade AGORA antes de baixar.
          const offer = await tx.offer.findUnique({ where: { id: ticket.offerId } })
          const held = await tx.reservation.aggregate({
            where: { offerId: ticket.offerId, status: 'active', expiresAt: { gt: new Date() } },
            _sum: { quantity: true },
          })
          const available = (offer?.quantity ?? 0) - (held._sum.quantity ?? 0)
          const quantity = (payment.order.items[0]?.quantity ?? 0)
          if (offer && offer.status === 'active' && available >= quantity) {
            await tx.offer.update({
              where: { id: offer.id },
              data: { quantity: { decrement: quantity } },
            })
            await markSoldIfEmpty(offer.id)
          } else {
            needsReview = true
          }
        }
      } else {
        // ── Pedido de PRODUTO (fluxo de carrinho original) ──
        for (const item of payment.order.items) {
          if (item.variantId === null) continue
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
          if (updated.count === 0) needsReview = true
        }
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: paidAt ? new Date(paidAt) : new Date(), lastSyncedAt: new Date() },
      })
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'paid', needsReview } })
      if (needsReview) {
        console.error(`[pagamento] pedido ${payment.order.code} PAID com estoque insuficiente — revisão manual necessária`)
      }
    })
    return
  }

  // REFUSED/CANCELED liberam o pedido a gerar novo Pix (order segue pending);
  // REFUNDED/CHARGEDBACK/IN_PROTEST avançam o pagamento (order continua paid)
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: nextStatus, lastSyncedAt: new Date(), ...(nextStatus === 'PAID' ? { paidAt: new Date() } : {}) },
  })
}
