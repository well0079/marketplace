import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Search } from './Search'
import { buildCatalogParams, type CategoryNode, type ProductsResponse } from '../lib/home'
import { seedErrorState } from '../test/query-test-utils'

const CATEGORIES: CategoryNode[] = [
  {
    id: 'c1',
    name: 'Informática',
    slug: 'informatica',
    children: [{ id: 'c1a', name: 'Notebooks', slug: 'notebooks', children: [] }],
  },
  { id: 'c2', name: 'Ferramentas', slug: 'ferramentas', children: [] },
]

const PRODUCTS: ProductsResponse = {
  page: 1,
  limit: 12,
  total: 2,
  totalPages: 1,
  items: [
    {
      id: 'p1',
      slug: 'notebook-lenovo',
      title: 'Notebook Lenovo IdeaPad 3i',
      price: 219900,
      originalPrice: 259900,
      discountPercent: 15,
      freeShipping: true,
      thumbnail: 'https://picsum.photos/seed/notebook/800/800',
      rating: { average: 4.5, count: 1520 },
    },
    {
      id: 'p2',
      slug: 'parafusadeira-bosch',
      title: 'Parafusadeira Bosch Go 3,6V',
      price: 32900,
      freeShipping: false,
      thumbnail: null,
      rating: { average: 4.8, count: 2210 },
    },
  ],
}

const EMPTY: ProductsResponse = { page: 1, limit: 12, total: 0, totalPages: 1, items: [] }

// Espelha a extração de filtros da página a partir da URL
function filtersFromPath(path: string) {
  const params = new URLSearchParams(path.split('?')[1] ?? '')
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    sort: params.get('sort') ?? 'relevance',
    page: Number.parseInt(params.get('page') ?? '1', 10) || 1,
  }
}

function renderSearch(path: string, options?: { categories?: CategoryNode[]; products?: ProductsResponse | 'error' }) {
  const filters = filtersFromPath(path)
  const seedingError = options?.products === 'error'
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(seedingError && { enabled: false }) } },
  })
  if (options?.categories) client.setQueryData(['categories'], options.categories)
  const catalogKey = ['products', 'catalog', filters]
  if (options?.products === 'error') seedErrorState(client, catalogKey)
  else if (options?.products) client.setQueryData(catalogKey, options.products)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('buildCatalogParams', () => {
  it('combina q, category, sort, page e limit', () => {
    const params = buildCatalogParams({ q: 'notebook', category: 'informatica', sort: 'price_asc', page: 2 })
    expect(params.get('q')).toBe('notebook')
    expect(params.get('category')).toBe('informatica')
    expect(params.get('sort')).toBe('price_asc')
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('12')
  })

  it('omite parâmetros vazios', () => {
    const params = buildCatalogParams({ page: 1 })
    expect(params.get('q')).toBeNull()
    expect(params.get('category')).toBeNull()
    expect(params.get('sort')).toBeNull()
    expect(params.get('page')).toBe('1')
  })
})

describe('Search — carregando', () => {
  it('exibe skeletons com grid estável', () => {
    const html = renderSearch('/search')
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(4)
  })
})

describe('Search — com dados', () => {
  it('/search lista produtos com contagem real', () => {
    const html = renderSearch('/search', { categories: CATEGORIES, products: PRODUCTS })
    expect(html).toContain('Todos os produtos')
    expect(html).toContain('2 produtos')
    expect(html).toMatch(/href="\/product\/notebook-lenovo"/)
    expect(html).not.toContain('Limpar filtros')
  })

  it('/search?q=aspirador reflete o termo no título e breadcrumb e habilita limpar filtros', () => {
    const html = renderSearch('/search?q=aspirador', { categories: CATEGORIES, products: PRODUCTS })
    // o HTML estático escapa aspas como &quot;
    expect(html).toContain('Resultados para &quot;aspirador&quot;')
    expect(html).toContain('Busca')
    expect(html).toContain('Limpar filtros')
  })

  it('/search?category=notebooks marca a categoria folha como filtro ativo e raiz como agrupamento', () => {
    const html = renderSearch('/search?category=notebooks', { categories: CATEGORIES, products: PRODUCTS })
    expect(html).toContain('>Notebooks</a>')
    expect(html).toContain('aria-current="true"')
    // raiz com filhos vira agrupamento (não é link — slug de raiz não tem produtos no contrato da API)
    expect(html).not.toContain('>Informática</a>')
    expect(html).toContain('Informática')
  })

  it('combina q + category + sort preservando o contexto', () => {
    const html = renderSearch('/search?q=notebook&category=informatica&sort=price_asc', {
      categories: CATEGORIES,
      products: PRODUCTS,
    })
    expect(html).toContain('Resultados para &quot;notebook&quot;')
    expect(html).toContain('em Informática')
    expect(html).toContain('price_asc')
  })

  it('expõe as opções de ordenação do contrato da API', () => {
    const html = renderSearch('/search', { categories: CATEGORIES, products: PRODUCTS })
    for (const label of ['Mais relevantes', 'Menor preço', 'Maior preço', 'Mais recentes']) {
      expect(html).toContain(label)
    }
  })

  it('paginação aparece quando totalPages > 1', () => {
    const html = renderSearch('/search', {
      categories: CATEGORIES,
      products: { ...PRODUCTS, total: 24, totalPages: 2 },
    })
    expect(html).toContain('Página 1 de 2')
    expect(html).toContain('Próxima')
  })
})

describe('Search — estados', () => {
  it('sem resultados mostra empty state com limpar filtros', () => {
    const html = renderSearch('/search?q=xyz-inexistente', { categories: CATEGORIES, products: EMPTY })
    expect(html).toContain('Nenhum produto encontrado')
    expect(html).toContain('Limpar filtros')
  })

  it('erro na API mostra ErrorState com retry sem derrubar a sidebar', () => {
    const html = renderSearch('/search', { categories: CATEGORIES, products: 'error' })
    expect(html).toContain('Não conseguimos carregar os produtos.')
    expect(html).toContain('Tentar novamente')
    expect(html).toContain('Categorias')
    expect(html).toContain('Informática')
  })
})
