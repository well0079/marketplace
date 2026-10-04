import { api } from './api'

export type CartItemPayload = {
  id: string
  variantId: string
  quantity: number
  unitPrice: number
  lineTotal: number
  stock: number
  product: {
    slug: string
    title: string
    thumbnail: string | null
    freeShipping: boolean
    variantAttributes: Record<string, string>
  }
}

export type CartPayload = {
  items: CartItemPayload[]
  subtotal: number
  totalItems: number
}

// Cache compartilhado por Header (contador), PDP (após adicionar) e página /cart
export const CART_QUERY_KEY = ['cart'] as const

export const cartApi = {
  get: () => api.get<CartPayload>('/cart'),
  addItem: (variantId: string, quantity: number) =>
    api.post<CartPayload>('/cart/items', { variantId, quantity }),
  updateItem: (itemId: string, quantity: number) =>
    api.patch<CartPayload>(`/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId: string) => api.delete<CartPayload>(`/cart/items/${itemId}`),
}
