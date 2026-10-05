// Cliente FastSoft — ÚNICO ponto do sistema que fala com o provedor de pagamento.
// Regras: chave NUNCA logada; payloads nunca logados; timeout em toda chamada;
// erros normalizados em FastSoftError (status 0 = falha de rede/timeout).
// Doc: https://developers.fastsoftbrasil.com/docs/intro/getting-started

const API_URL = process.env.FASTSOFT_API_URL ?? 'https://api.fastsoftbrasil.com'
const TIMEOUT_MS = 15_000

export class FastSoftError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerMessage?: string,
  ) {
    super(message)
  }
}

// Objeto transação (schema confirmado em "Obter Transação > Example (auto)" —
// docs/api/user-transaction-controller-get-transaction)
export type FastSoftTransaction = {
  id: string
  amount: number
  status: string
  externalRef?: string | null
  metadata?: string | null
  paidAt?: string | null
  createdAt?: string | null
  paymentMethod?: string | null
  pix?: { qrcode?: string; url?: string; expirationDate?: string } | null
  refusedReason?: string | null
}

function authHeader(): string {
  const key = process.env.FASTSOFT_SECRET_KEY
  if (!key) {
    throw new FastSoftError('FASTSOFT_SECRET_KEY não configurada', 0)
  }
  return `Basic ${Buffer.from(`x:${key}`).toString('base64')}`
}

async function request(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<FastSoftTransaction> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        Authorization: authHeader(),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      // A doc mostra { message, statusCode } nos erros de autenticação, mas o corpo
      // de validação pode ter outra forma. Preservamos um TRECHO sanitizado (dígitos
      // de 5+ casas mascarados — CPF/telefone nunca aparecem) para diagnóstico;
      // o payload enviado nunca é logado.
      const raw = await res.text().catch(() => '')
      let providerMessage = raw
      try {
        const parsed = JSON.parse(raw) as unknown
        providerMessage = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
      } catch {
        /* corpo não-JSON: usa o texto bruto */
      }
      const sanitized = providerMessage.replace(/\d{5,}/g, '***').slice(0, 500)
      throw new FastSoftError(`FastSoft respondeu ${res.status}`, res.status, sanitized || undefined)
    }
    const payload = (await res.json().catch(() => null)) as { data?: FastSoftTransaction } | null
    if (!payload?.data?.id) {
      throw new FastSoftError('Resposta da FastSoft sem transação', res.status)
    }
    return payload.data
  } catch (error) {
    if (error instanceof FastSoftError) throw error
    throw new FastSoftError('Falha de conexão com a FastSoft', 0)
  } finally {
    clearTimeout(timer)
  }
}

export type CreateTransactionInput = {
  amount: number
  currency: string
  paymentMethod: 'PIX'
  customer: { name: string; email: string; document: { number: string; type: 'CPF' }; phone: string }
  shipping: { fee: number; address: Record<string, string> }
  items: { title: string; unitPrice: number; quantity: number; tangible: boolean; externalRef: string }[]
  pix: { expiresInDays: number }
  // string JSON (formato da doc): carrega o código do pedido — a API real rejeita
  // "externalRef" no nível raiz (400 whitelist)
  metadata: string
  traceable: boolean
  ip: string
  postbackUrl?: string
}

// POST /api/user/transactions — resposta 200/201 com { data: transação }
export function createTransaction(input: CreateTransactionInput): Promise<FastSoftTransaction> {
  return request('/api/user/transactions', { method: 'POST', body: input })
}

// GET /api/user/transactions/:id — fonte da verdade para sincronizar status
export function getTransaction(id: string): Promise<FastSoftTransaction> {
  return request(`/api/user/transactions/${encodeURIComponent(id)}`, { method: 'GET' })
}

export function isConfigured(): boolean {
  return Boolean(process.env.FASTSOFT_SECRET_KEY)
}
