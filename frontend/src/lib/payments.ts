import { api } from './api'

// Pagamentos Pix (FastSoft via backend) — o frontend NUNCA fala com o provedor.

export type PaymentStatus =
  | 'WAITING_PAYMENT'
  | 'PROCESSING'
  | 'IN_ANALYSIS'
  | 'AUTHORIZED'
  | 'PAID'
  | 'REFUNDED'
  | 'CHARGEDBACK'
  | 'IN_PROTEST'
  | 'REFUSED'
  | 'CANCELED'

export type PaymentDetail = {
  paymentId: string
  status: string
  paid: boolean
  orderCode: string
  amount: number
  pix: { qrCode: string | null; qrImageUrl: string | null; expiresAt: string | null } | null
}

export function paymentQueryKey(paymentId: string) {
  return ['payments', paymentId] as const
}

export const paymentsApi = {
  create: (input: {
    orderCode: string
    method: 'pix'
    payer: { name: string; document: string; phone: string }
    idempotencyKey: string
  }) => api.post<PaymentDetail>('/payments', { orderCode: input.orderCode, method: input.method, payer: input.payer }, {
    'Idempotency-Key': input.idempotencyKey,
  }),
  get: (paymentId: string) => api.get<PaymentDetail>(`/payments/${encodeURIComponent(paymentId)}`),
}

// ---- helpers puros (testados) ----

// Polling do GET /payments/:id: só enquanto aguardando o provedor; pausa com aba oculta
export const PAYMENT_POLL_MS = 4000

export function isActivePaymentStatus(status: string): boolean {
  return status === 'WAITING_PAYMENT' || status === 'PROCESSING'
}

export function paymentRefetchInterval(query: {
  state: { data?: PaymentDetail | null; fetchStatus: string }
}): number | false {
  const status = query.state.data?.status
  if (!status || !isActivePaymentStatus(status)) return false
  if (typeof document !== 'undefined' && document.hidden) return false
  return PAYMENT_POLL_MS
}

// Segundos restantes até a expiração do Pix (negativo = expirado)
export function secondsUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.floor((target - now) / 1000)
}

// O doc confirma pix.qrcode; o example mostra base64 de imagem PNG — tratamos os
// dois formatos: imagem embutida, URL de imagem ou string EMV (copia e cola)
export function pixQrCodeKind(qrCode: string | null): 'image' | 'url' | 'text' | null {
  if (!qrCode) return null
  if (qrCode.startsWith('data:image')) return 'image'
  if (qrCode.startsWith('iVBORw')) return 'image'
  if (/^https?:\/\//i.test(qrCode)) return 'url'
  return 'text'
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function paymentStatusMeta(status: string): { label: string; tone: 'waiting' | 'paid' | 'refused' } {
  if (status === 'PAID') return { label: 'Pago', tone: 'paid' }
  if (status === 'REFUSED' || status === 'CANCELED') return { label: 'Pagamento não concluído', tone: 'refused' }
  return { label: 'Aguardando pagamento', tone: 'waiting' }
}
