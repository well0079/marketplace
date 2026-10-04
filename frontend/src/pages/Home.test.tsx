import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './Home'
import { pickOffers, type CategoryNode, type ProductsResponse } from '../lib/home'
import type { ProductCardData } from '../components/ecommerce/ProductCard'
import { seedErrorState } from '../test/query-test-utils'

const CATEGORIES: CategoryNode[] = [
  { id: 'c1', name: 'Celulares e Telefones', slug: 'celulares-e-telefones', children: [] },
  { id: 'c2', name: 'Informática', slug: 'informatica', children: [] },
]

const PRODUCTS: ProductsResponse = {
  page: 1,
  limit: 20,
  total: 2,
  totalPages: 1,
  items: [
    {
      id: 'p1',
      slug: 'fone-jbl',
      title: 'Fone de Ouvido Bluetooth JBL Tune 520BT',
      price: 24900,
      originalPrice: 32900,
      discountPercent: 24,
      freeShipping: false,
      thumbnail: 'https://picsum.photos/seed/fone/800/800',
      rating: { average: 4.6, count: 4210 },
    },
    {
      id: 'p2',
      slug: 'tv-tcl',
      title: 'Smart TV TCL 43 Polegadas QLED 4K',
      price: 139900,
      freeShipping: true,
      thumbnail: null,
      rating: { average: 4.5, count: 940 },
    },
  ],
}

function renderHome(options?: { categories?: CategoryNode[] | 'error'; products?: ProductsResponse | 'error' }) {
  const seedingError = options?.categories === 'error' || options?.products === 'error'
  // enabled:false: sem simulação de refetch no render estático, o useQuery reflete o estado de erro injetado
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(seedingError && { enabled: false }) } },
  })
  if (options?.categories === 'error') {
    seedErrorState(client, ['categories'])
  } else if (options?.categories) {
    client.setQueryData(['categories'], options.categories)
  }
  if (options?.products === 'error') {
    seedErrorState(client, ['products', 'home'])
  } else if (options?.products) {
    client.setQueryData(['products', 'home'], options.products)
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Home — carregando', () => {
  it('renderiza main semântico com hero e CTA', async () => {
    const html = await renderHome()
    expect(html).toContain('<main')
    expect(html).toContain('Encontre o que você precisa')
    expect(html).toContain('Explorar produtos')
  })

  it('exibe skeletons enquanto os dados carregam', async () => {
    const html = await renderHome()
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(4)
  })
})

describe('Home — com dados', () => {
  it('renderiza categorias reais com link no formato da API', async () => {
    const html = await renderHome({ categories: CATEGORIES, products: PRODUCTS })
    expect(html).toContain('Informática')
    expect(html).toMatch(/href="\/search\?category=informatica"/)
  })

  it('renderiza produtos em destaque com link para a página de produto', async () => {
    const html = await renderHome({ categories: CATEGORIES, products: PRODUCTS })
    expect(html).toMatch(/href="\/product\/fone-jbl"/)
    expect(html).toContain('249,00')
  })

  it('renderiza a seção de ofertas com percentual de desconto', async () => {
    const html = await renderHome({ categories: CATEGORIES, products: PRODUCTS })
    expect(html).toContain('Ofertas especiais')
    expect(html).toContain('24% OFF')
  })
})

describe('Home — erro na API', () => {
  it('mostra ErrorState com retry sem derrubar a Home', async () => {
    const html = await renderHome({ categories: 'error', products: 'error' })
    expect(html).toContain('Não conseguimos carregar os produtos.')
    expect(html).toContain('Tentar novamente')
    expect(html).toContain('Encontre o que você precisa')
  })
})

describe('pickOffers', () => {
  const items: ProductCardData[] = [
    { id: 'a', slug: 'a', title: 'A', price: 100, discountPercent: 10 },
    { id: 'b', slug: 'b', title: 'B', price: 100, discountPercent: 30 },
    { id: 'c', slug: 'c', title: 'C', price: 100 },
    { id: 'd', slug: 'd', title: 'D', price: 100, discountPercent: 20, outOfStock: true },
  ]

  it('retorna somente produtos com desconto, do maior para o menor', () => {
    expect(pickOffers(items, 4).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('limita ao máximo pedido', () => {
    expect(pickOffers(items, 1).map((p) => p.id)).toEqual(['b'])
  })
})
