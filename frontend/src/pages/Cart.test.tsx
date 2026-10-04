import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Cart } from './Cart'
import type { CartPayload } from '../lib/cart'
import { seedErrorState } from '../test/query-test-utils'

const ITEM: CartPayload['items'][number] = {
  id: 'item-1',
  variantId: 'v1',
  quantity: 2,
  unitPrice: 10000,
  lineTotal: 20000,
  stock: 10,
  product: {
    slug: 'produto-cart-test',
    title: 'Produto Cart Test Azul',
    thumbnail: 'https://picsum.photos/seed/cart/200/200',
    freeShipping: true,
    variantAttributes: { Cor: 'Azul' },
  },
}

const CART: CartPayload = { items: [ITEM], subtotal: 20000, totalItems: 2 }

function renderCart(options?: { cart?: CartPayload | 'error' }) {
  const seedingError = options?.cart === 'error'
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(seedingError && { enabled: false }) } },
  })
  if (options?.cart === 'error') seedErrorState(client, ['cart'])
  else if (options?.cart) client.setQueryData(['cart'], options.cart)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/cart" element={<Cart />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Cart — carregando', () => {
  it('exibe skeleton com estrutura da página', () => {
    const html = renderCart()
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(3)
  })
})

describe('Cart — com itens', () => {
  const html = renderCart({ cart: CART })

  it('renderiza item com imagem, título, variante e preço unitário', () => {
    expect(html).toContain('Produto Cart Test Azul')
    expect(html).toContain('Cor: Azul')
    expect(html).toContain('R$ 100,00 un.')
    expect(html).toMatch(/src="https:\/\/picsum\.photos\/seed\/cart\/200\/200"/)
  })

  it('renderiza subtotal do item e total geral calculados no backend', () => {
    expect(html).toContain('R$ 200,00')
    expect(html).toContain('Subtotal')
    expect(html).toContain('Total')
  })

  it('renderiza contagem de itens e controles', () => {
    expect(html).toContain('2 itens')
    expect(html).toContain('Remover')
    expect(html).toContain('aria-label="Diminuir quantidade"')
    expect(html).toContain('aria-label="Aumentar quantidade"')
  })

  it('oferece continuar comprando e finalizar compra', () => {
    expect(html).toContain('Continuar comprando')
    expect(html).toContain('Finalizar compra')
  })
})

describe('Cart — estados', () => {
  it('carrinho vazio mostra empty state com ação', () => {
    const html = renderCart({ cart: { items: [], subtotal: 0, totalItems: 0 } })
    expect(html).toContain('Seu carrinho está vazio')
    expect(html).toContain('Explorar produtos')
    expect(html).not.toContain('Finalizar compra')
  })

  it('erro da API mostra ErrorState com retry', () => {
    const html = renderCart({ cart: 'error' })
    expect(html).toContain('Não conseguimos carregar seu carrinho.')
    expect(html).toContain('Tentar novamente')
  })
})
