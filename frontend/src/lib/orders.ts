import { api } from './api'

// Pedidos: contratos de POST /orders, listagem, detalhe e cancelamento.
// Valores em centavos; formatação só via lib/format.

export type OrderItemSnapshot = {
  variantId: string
  productId: string
  slug: string
  title: string
  thumbnail: string | null
  attributes: Record<string, string>
  unitPrice: number
  quantity: number
  lineTotal: number
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled'

export type OrderDetail = {
  code: string
  status: OrderStatus
  paymentPending: boolean
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  deliveryOption: { id: string; label: string; description: string; region: string; price: number } | null
  shippingAddress: Record<string, string> | null
  ticketSnapshot: Record<string, unknown> | null
  activePaymentId: string | null
  items: OrderItemSnapshot[]
  createdAt: string
  cancelledAt: string | null
}

export type OrderSummary = {
  code: string
  status: OrderStatus
  total: number
  createdAt: string
  firstItemImage: string | null
  itemsCount: number
  ticketSnapshot: Record<string, unknown> | null
}

export type OrdersPage = {
  items: OrderSummary[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const ORDERS_QUERY_KEY = ['orders'] as const

export function ordersPageQueryKey(page: number) {
  return ['orders', 'list', page] as const
}

export function orderQueryKey(code: string) {
  return ['orders', 'detail', code] as const
}

export const ordersApi = {
  create: (input: { addressId: string; deliveryOption: string; idempotencyKey: string }) =>
    api.post<OrderDetail>('/orders', { addressId: input.addressId, deliveryOption: input.deliveryOption }, {
      'Idempotency-Key': input.idempotencyKey,
    }),
  list: (page: number, kind?: 'ticket' | 'product') => {
    const kindQuery = kind ? `&kind=${kind}` : ''
    return api.get<OrdersPage>(`/orders?page=${page}&limit=10${kindQuery}`)
  },
  byCode: (code: string) => api.get<OrderDetail>(`/orders/${encodeURIComponent(code)}`),
  cancel: (code: string) => api.post<OrderDetail>(`/orders/${encodeURIComponent(code)}/cancel`, {}),
}

// ---- helpers puros (testados) ----

export type IdempotencyLease = { signature: string; key: string }

// A MESMA key cobre retries de rede da mesma tentativa; mudou endereço/entrega/
// carrinho (signature), é uma nova tentativa → nova key
export function resolveIdempotencyKey(
  lease: IdempotencyLease | null,
  signature: string,
  generate: () => string,
): IdempotencyLease {
  if (lease && lease.signature === signature) return lease
  return { signature, key: generate() }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function orderStatusMeta(status: OrderStatus): { label: string; badge: 'warning' | 'destructive' | 'success' } {
  if (status === 'cancelled') return { label: 'Cancelado', badge: 'destructive' }
  if (status === 'paid') return { label: 'Pago', badge: 'success' }
  return { label: 'Aguardando pagamento', badge: 'warning' }
}

export function formatOrderItemAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes)
  return entries.length > 0 ? entries.map(([key, value]) => `${key}: ${value}`).join(' · ') : 'Produto padrão'
}

// Shape mínimo de erro da API (ApiClientError satisfaz; útil em funções puras)
export type ApiErrorLike = { code: string; status: number; message: string; fields?: Record<string, string> }

// Mensagem de erro da confirmação do pedido, mapeada para a UI
export function describeOrderError(error: unknown): {
  kind: 'stock' | 'cart-empty' | 'generic'
  message: string
  fields: Record<string, string>
} {
  if (error && typeof error === 'object' && 'code' in error && 'status' in error) {
    const err = error as ApiErrorLike
    if (err.code === 'STOCK_INSUFFICIENT') {
      const fields = err.fields ?? {}
      const detail = Object.values(fields).join(' ')
      return { kind: 'stock', message: detail || err.message, fields }
    }
    if (err.code === 'CART_EMPTY') {
      return { kind: 'cart-empty', message: 'Seu carrinho ficou vazio. Volte ao carrinho para revisar os itens.', fields: {} }
    }
    if (err.status === 0) {
      return { kind: 'generic', message: 'Sem conexão com o servidor. Tente novamente.', fields: {} }
    }
    return { kind: 'generic', message: err.message, fields: {} }
  }
  return { kind: 'generic', message: 'Não foi possível confirmar o pedido. Tente novamente.', fields: {} }
}
