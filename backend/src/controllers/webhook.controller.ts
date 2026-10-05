import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { normalizeStatus, syncPaymentFromProvider } from '../services/payment.service'

// Webhook FastSoft — endpoint PÚBLICO, sem assinatura documentada: NUNCA confiar
// no payload. Fluxo: validar formato → persistir bruto com dedupe → achar o
// pagamento pelo id da transação → CONSULTAR a FastSoft (Obter Transação) e
// conferir amount/externalRef → aplicar transição com guarda de estado.
// Consulta falhando = 5xx (a FastSoft reenvia). Resposta rápida e sem detalhes.

type WebhookBody = {
  type?: unknown
  objectId?: unknown
  data?: { id?: unknown; status?: unknown; amount?: unknown; externalRef?: unknown } | null
}

export async function fastsoftWebhook(req: Request, res: Response) {
  const body = (req.body ?? {}) as WebhookBody
  const transactionId = typeof body.objectId === 'string' ? body.objectId : typeof body.data?.id === 'string' ? body.data.id : ''
  const status = typeof body.data?.status === 'string' ? normalizeStatus(body.data.status) : ''

  // Formato inválido: sem chance de virar evento útil
  if (!transactionId || !status || typeof body.data?.amount !== 'number') {
    res.status(400).json({ received: false, reason: 'invalid_payload' })
    return
  }

  const dedupeKey = createHash('sha256').update(JSON.stringify(req.body)).digest('hex')

  let paymentId: string | null = null
  try {
    const payment = await prisma.payment.findUnique({ where: { providerTransactionId: transactionId } })
    if (!payment) {
      // Transação desconhecida: não adianta a FastSoft reenviar
      res.status(200).json({ received: true, applied: false, reason: 'unknown_transaction' })
      return
    }
    paymentId = payment.id
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        providerTransactionId: transactionId,
        eventType: typeof body.type === 'string' ? body.type : 'transaction',
        dedupeKey,
        rawPayload: body as unknown as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Evento duplicado (mesmo conteúdo): já processado/registrado
      res.status(200).json({ received: true, applied: false, reason: 'duplicate' })
      return
    }
    throw error
  }

  // Fonte da verdade é a consulta autenticada na FastSoft, não o payload recebido
  try {
    await syncPaymentFromProvider(paymentId)
  } catch (error) {
    console.error(`[webhook] consulta à FastSoft falhou para ${transactionId}: ${(error as Error).message}`)
    res.status(502).json({ received: true, applied: false, reason: 'provider_unavailable' })
    return
  }

  // Confirmação aplicada com sucesso; se a transição foi ignorada (guarda/dedupe),
  // ainda respondemos 200 — reenvio não mudaria o resultado
  res.status(200).json({ received: true })
}
