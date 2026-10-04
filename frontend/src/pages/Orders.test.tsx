import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Orders } from './Orders'
import { OrderDetail } from './OrderDetail'
import { OrderReceived } from './OrderReceived'
import {
  orderQueryKey,
  ordersPageQueryKey,
  type OrderDetail as OrderDetailData,
  type OrderSummary,
} from '../lib/orders'
import { ApiClientError } from '../lib/api'
import type { PublicUser } from '../lib/auth'
import { seedErrorState } from '../test/query-test-utils'

const NOT_FOUND = new ApiClientError('Pedido não encontrado', 'NOT_FOUND', 404)

const USER: PublicUser = { id: 'u1', name: 'Ana Silva', email: 'ana@teste.com' }

const ORDER_DETAIL: OrderDetailData = {
  code: 'RD-AB12CD34',
  status: 'pending',
  paymentPending: true,
  subtotal: 20000,
  shippingCost: 1990,
  discount: 0,
  total: 21990,
  deliveryOption: { id: 'standard', label: 'Normal', description: 'Chega entre 3 e 6 dias úteis', region: 'Sudeste', price: 1990 },
  shippingAddress: {
    label: 'Casa',
    recipient: 'Ana Silva',
    zipCode: '01310000',
    street: 'Avenida Paulista',
    number: '1000',
    complement: '',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  items: [
    {
      variantId: 'v1',
      productId: 'p1',
      slug: 'fone-bluetooth',
      title: 'Fone de Ouvido Bluetooth JBL',
      thumbnail: 'https://picsum.photos/seed/order/200/200',
      attributes: { Cor: 'Preto' },
      unitPrice: 10000,
      quantity: 2,
      lineTotal: 20000,
    },
  ],
  createdAt: '2026-10-04T12:00:00.000Z',
  cancelledAt: null,
}

const ORDER_SUMMARY: OrderSummary = {
  code: 'RD-AB12CD34',
  status: 'pending',
  total: 21990,
  createdAt: '2026-10-04T12:00:00.000Z',
  firstItemImage: 'https://picsum.photos/seed/order/200/200',
  itemsCount: 2,
}

const PAGE = { items: [ORDER_SUMMARY], page: 1, limit: 10, total: 1, totalPages: 1 }

function renderWith(
  element: ReactElement,
  seeds: {
    user?: PublicUser | null
    orders?: typeof PAGE | 'error'
    order?: OrderDetailData | 'error'
    initialPath: string
  },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  })
  client.setQueryData(['auth', 'me'], seeds.user !== undefined ? seeds.user : USER)
  if (seeds.orders === 'error') seedErrorState(client, ordersPageQueryKey(1))
  else if (seeds.orders) client.setQueryData(ordersPageQueryKey(1), seeds.orders)
  if (seeds.order === 'error') seedErrorState(client, orderQueryKey('RD-AB12CD34'), NOT_FOUND)
  else if (seeds.order) client.setQueryData(orderQueryKey('RD-AB12CD34'), seeds.order)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[seeds.initialPath]}>
        <Routes>
          <Route path="/orders" element={element} />
          <Route path="/orders/:code" element={element} />
          <Route path="/checkout/pedido-recebido/:code" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Orders — portão de login', () => {
  it('anônimo vê convite para entrar com redirect de volta', () => {
    const html = renderWith(<Orders />, { user: null, initialPath: '/orders' })
    expect(html).toContain('/login?redirect=%2Forders')
    expect(html).not.toContain('Meus pedidos</h1>')
  })
})

describe('Orders — estados', () => {
  it('carregando exibe skeleton', () => {
    const html = renderWith(<Orders />, { initialPath: '/orders' })
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(2)
  })

  it('erro exibe ErrorState com retry', () => {
    const html = renderWith(<Orders />, { orders: 'error', initialPath: '/orders' })
    expect(html).toContain('Não conseguimos carregar seus pedidos.')
    expect(html).toContain('Tentar novamente')
  })

  it('vazio exibe EmptyState com link para a Home', () => {
    const html = renderWith(<Orders />, {
      orders: { items: [], page: 1, limit: 10, total: 0, totalPages: 1 },
      initialPath: '/orders',
    })
    expect(html).toContain('Você ainda não fez pedidos')
    expect(html).toContain('Voltar para a Home')
  })
})

describe('Orders — lista', () => {
  const html = renderWith(<Orders />, { orders: PAGE, initialPath: '/orders' })

  it('renderiza cartão com código, badge, data, total e itens', () => {
    expect(html).toContain('Pedido RD-AB12CD34')
    expect(html).toContain('Aguardando pagamento')
    expect(html).toContain('04/10/2026')
    expect(html).toContain('R$ 219,90')
    expect(html).toContain('2 itens')
    expect(html).toContain('Ver detalhes')
  })

  it('cada cartão aponta para o detalhe do pedido', () => {
    expect(html).toContain('href="/orders/RD-AB12CD34"')
  })

  it('status cancelado usa badge próprio', () => {
    const htmlCancelled = renderWith(<Orders />, {
      orders: { ...PAGE, items: [{ ...ORDER_SUMMARY, status: 'cancelled' as const }] },
      initialPath: '/orders',
    })
    expect(htmlCancelled).toContain('Cancelado')
  })
})

describe('OrderDetail — estados', () => {
  it('carregando exibe skeleton', () => {
    const html = renderWith(<OrderDetail />, { initialPath: '/orders/RD-AB12CD34' })
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(1)
  })

  it('404 mostra EmptyState com volta para a lista', () => {
    const html = renderWith(<OrderDetail />, { order: 'error', initialPath: '/orders/RD-AB12CD34' })
    expect(html).toContain('Pedido não encontrado')
    expect(html).toContain('Ver meus pedidos')
  })
})

describe('OrderDetail — conteúdo', () => {
  const html = renderWith(<OrderDetail />, { order: ORDER_DETAIL, initialPath: '/orders/RD-AB12CD34' })

  it('renderiza código, status, itens com atributos e preços', () => {
    expect(html).toContain('Pedido RD-AB12CD34')
    expect(html).toContain('Aguardando pagamento')
    expect(html).toContain('Fone de Ouvido Bluetooth JBL')
    expect(html).toContain('Cor: Preto')
    expect(html).toContain('R$ 100,00 un.')
    expect(html).toContain('R$ 219,90')
  })

  it('renderiza endereço e entrega', () => {
    expect(html).toContain('Ana Silva')
    expect(html).toContain('Avenida Paulista, 1000')
    expect(html).toContain('CEP 01310-000')
    expect(html).toContain('Chega entre 3 e 6 dias úteis')
  })

  it('pedido pending oferece cancelamento (confirmação em dois passos verificada no navegador)', () => {
    expect(html).toContain('Cancelar pedido')
    expect(html).toContain('você pode cancelar o pedido sem custo')
  })

  it('pedido cancelado não oferece cancelamento e mostra data', () => {
    const htmlCancelled = renderWith(<OrderDetail />, {
      order: { ...ORDER_DETAIL, status: 'cancelled', cancelledAt: '2026-10-04T13:00:00.000Z' },
      initialPath: '/orders/RD-AB12CD34',
    })
    expect(htmlCancelled).toContain('Cancelado em')
    expect(htmlCancelled).not.toContain('Cancelar pedido')
  })
})

describe('OrderReceived — pós-confirmação', () => {
  const html = renderWith(<OrderReceived />, {
    order: ORDER_DETAIL,
    initialPath: '/checkout/pedido-recebido/RD-AB12CD34',
  })

  it('exibe confirmação com código, status e aviso honesto de pagamento', () => {
    expect(html).toContain('Pedido recebido')
    expect(html).toContain('RD-AB12CD34')
    expect(html).toContain('aguardando pagamento')
    expect(html).toContain('não foi cobrado')
  })

  it('linka para Meus pedidos e não tem botão de pagar', () => {
    expect(html).toContain('Ver meus pedidos')
    expect(html.toLowerCase()).not.toContain('pagar agora')
  })

  it('404 mostra estado vazio', () => {
    const htmlMissing = renderWith(<OrderReceived />, {
      order: 'error',
      initialPath: '/checkout/pedido-recebido/RD-AB12CD34',
    })
    expect(htmlMissing).toContain('Pedido não encontrado')
  })
})
