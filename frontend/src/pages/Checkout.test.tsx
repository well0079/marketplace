import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Checkout } from './Checkout'
import type { CartPayload } from '../lib/cart'
import { ADDRESSES_QUERY_KEY, shippingQueryKey, type Address, type ShippingQuote } from '../lib/checkout'
import type { PublicUser } from '../lib/auth'
import { seedErrorState } from '../test/query-test-utils'

const USER: PublicUser = { id: 'u1', name: 'Ana Silva', email: 'ana@teste.com' }

const ITEM: CartPayload['items'][number] = {
  id: 'item-1',
  variantId: 'v1',
  quantity: 2,
  unitPrice: 10000,
  lineTotal: 20000,
  stock: 10,
  product: {
    slug: 'produto-checkout-test',
    title: 'Produto Checkout Test Azul',
    thumbnail: 'https://picsum.photos/seed/checkout/200/200',
    freeShipping: true,
    variantAttributes: { Cor: 'Azul' },
  },
}

const CART: CartPayload = { items: [ITEM], subtotal: 20000, totalItems: 2 }

const ADDRESS: Address = {
  id: 'addr-1',
  label: 'Casa',
  recipient: 'Ana Silva',
  zipCode: '01310000',
  street: 'Avenida Paulista',
  number: '1000',
  complement: null,
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  isDefault: true,
}

const QUOTE: ShippingQuote = {
  zipCode: '01310000',
  region: 'Sudeste',
  options: [
    { id: 'standard', label: 'Normal', description: 'Chega entre 3 e 6 dias úteis', price: 0 },
    { id: 'express', label: 'Expressa', description: 'Chega entre 1 e 2 dias úteis', price: 3990 },
  ],
}

type Seed = {
  user?: PublicUser | null
  cart?: CartPayload | 'error'
  addresses?: Address[] | 'error'
  quote?: ShippingQuote
}

function renderCheckout(seed: Seed = {}) {
  // No render estático o useQuery re-tenta queries com erro no mount (retryOnMount),
  // o que apagaria o estado de erro semeado; staleTime: Infinity evita refetch dos
  // dados semeados. (queries com `enabled` por-query ignoram enabled:false do client)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  })
  if (seed.user !== undefined) client.setQueryData(['auth', 'me'], seed.user)
  if (seed.cart === 'error') seedErrorState(client, ['cart'])
  else if (seed.cart) client.setQueryData(['cart'], seed.cart)
  if (seed.addresses === 'error') seedErrorState(client, ADDRESSES_QUERY_KEY)
  else if (seed.addresses) client.setQueryData(ADDRESSES_QUERY_KEY, seed.addresses)
  if (seed.quote) client.setQueryData(shippingQueryKey(seed.quote.zipCode), seed.quote)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Checkout — carregando', () => {
  it('exibe skeleton enquanto verifica a sessão', () => {
    const html = renderCheckout()
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(0)
  })
})

describe('Checkout — portão de login', () => {
  it('usuário anônimo vê convite para entrar apontando de volta ao checkout', () => {
    const html = renderCheckout({ user: null, cart: CART })
    expect(html).toContain('Entre para finalizar a compra')
    expect(html).toContain('/login?redirect=%2Fcheckout')
    expect(html).toContain('/register?redirect=%2Fcheckout')
    expect(html).not.toContain('Resumo do pedido')
  })
})

describe('Checkout — carrinho vazio', () => {
  it('mostra empty state com ação para o catálogo', () => {
    const html = renderCheckout({ user: USER, cart: { items: [], subtotal: 0, totalItems: 0 } })
    expect(html).toContain('Seu carrinho está vazio')
    expect(html).toContain('Explorar produtos')
  })
})

describe('Checkout — com itens e endereço', () => {
  const html = renderCheckout({ user: USER, cart: CART, addresses: [ADDRESS] })

  it('renderiza o endereço padrão selecionado', () => {
    expect(html).toContain('Ana Silva')
    expect(html).toContain('Avenida Paulista, 1000')
    expect(html).toContain('Bela Vista, São Paulo - SP · CEP 01310-000')
    expect(html).toContain('Padrão')
    expect(html).toContain('aria-checked="true"')
  })

  it('renderiza itens no resumo com subtotal do backend', () => {
    expect(html).toContain('Resumo do pedido')
    expect(html).toContain('Produto Checkout Test Azul')
    expect(html).toContain('2 unidades')
    expect(html).toContain('R$ 200,00')
  })

  it('frete aparece como pendente até a cotação estar disponível', () => {
    expect(html).toContain('Frete')
    expect(html).toContain('O total é finalizado após escolher a opção de entrega.')
  })

  it('etapas de endereço, entrega e revisão estão presentes', () => {
    expect(html).toContain('Endereço de entrega')
    expect(html).toContain('Entrega')
    expect(html).toContain('Revisão')
  })
})

describe('Checkout — opções de entrega', () => {
  it('cotação renderiza Normal grátis (padrão) e Expressa paga, com total somado', () => {
    const html = renderCheckout({ user: USER, cart: CART, addresses: [ADDRESS], quote: QUOTE })
    expect(html).toContain('Envio para Sudeste')
    expect(html).toContain('Grátis')
    expect(html).toContain('Chega entre 3 e 6 dias úteis')
    expect(html).toContain('Expressa')
    expect(html).toContain('R$ 39,90')
    // Normal (grátis) vem selecionada por padrão
    expect(html).toContain('checked=""')
    // total = 20000 (produtos) + 0 (Normal)
    expect(html).toContain('R$ 200,00')
  })
})

describe('Checkout — etapa de Revisão', () => {
  it('revisão lista itens com atributos, quantidade, endereço, entrega e botão de confirmação', () => {
    const html = renderCheckout({ user: USER, cart: CART, addresses: [ADDRESS], quote: QUOTE })
    expect(html).toContain('Confirmar pedido')
    expect(html).toContain('Cor: Azul')
    expect(html).toContain('2 unidades · R$ 100,00 un.')
    expect(html).toContain('Avenida Paulista, 1000')
    expect(html).toContain('Normal — Chega entre 3 e 6 dias úteis (R$ 0,00)')
    expect(html).toContain('Você não será cobrado agora')
  })

  it('botão Confirmar desabilitado enquanto a entrega não está definida', () => {
    const html = renderCheckout({ user: USER, cart: CART, addresses: [ADDRESS] })
    expect(html).toMatch(/disabled=""/)
    expect(html).toContain('Escolha a entrega na etapa 2.')
  })
})

describe('Checkout — erros', () => {
  it('erro ao carregar endereços mostra ErrorState com retry', () => {
    const html = renderCheckout({ user: USER, cart: CART, addresses: 'error' })
    expect(html).toContain('Não conseguimos carregar seus endereços.')
    expect(html).toContain('Tentar novamente')
  })

  it('erro ao carregar o carrinho mostra ErrorState com retry', () => {
    const html = renderCheckout({ user: USER, cart: 'error' })
    expect(html).toContain('Não conseguimos carregar seu carrinho.')
    expect(html).toContain('Tentar novamente')
  })
})
