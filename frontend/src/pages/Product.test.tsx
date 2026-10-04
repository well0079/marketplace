import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Product } from './Product'
import { clampQuantity, variantAttributeGroups, type ProductsResponse, type ProductDetail } from '../lib/home'
import { ApiClientError } from '../lib/api'
import { seedErrorState } from '../test/query-test-utils'

const PRODUCT: ProductDetail = {
  id: 'p1',
  slug: 'aspirador-wap',
  title: 'Aspirador De Pó E Água Wap Gtw 10',
  description: 'Aspirador de pó e água de 1400W com tanque de 10 litros e filtro permanente.',
  brand: 'Wap',
  price: 25990,
  originalPrice: 39900,
  discountPercent: 35,
  freeShipping: true,
  condition: 'new',
  sold: 100000,
  rating: { average: 4.8, count: 450 },
  images: [
    { url: 'https://picsum.photos/seed/wap-1/800/800', alt: 'Aspirador Wap — imagem 1' },
    { url: 'https://picsum.photos/seed/wap-2/800/800', alt: 'Aspirador Wap — imagem 2' },
  ],
  variants: [
    { id: 'v1', attributes: { Voltagem: '127V' }, price: 25990, stock: 51 },
    { id: 'v2', attributes: { Voltagem: '220V' }, price: 26990, stock: 0 },
  ],
  category: {
    name: 'Aspiradores',
    slug: 'aspiradores',
    breadcrumb: [
      { name: 'Eletrodomésticos', slug: 'eletrodomesticos' },
      { name: 'Aspiradores', slug: 'aspiradores' },
    ],
  },
}

const RELATED: ProductsResponse = {
  page: 1,
  limit: 5,
  total: 2,
  totalPages: 1,
  items: [
    { id: 'p1', slug: 'aspirador-wap', title: 'Aspirador De Pó E Água Wap Gtw 10', price: 25990, thumbnail: null },
    { id: 'p2', slug: 'aspirador-robot', title: 'Aspirador Robô Xiaomi S10', price: 129900, freeShipping: true, thumbnail: null },
  ],
}

function renderProduct(slug: string, options?: { product?: ProductDetail | 'error' | 'error404'; related?: ProductsResponse }) {
  const seedingError = options?.product === 'error' || options?.product === 'error404'
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(seedingError && { enabled: false }) } },
  })
  if (options?.product === 'error') {
    seedErrorState(client, ['product', slug], new Error('boom'))
  } else if (options?.product === 'error404') {
    seedErrorState(client, ['product', slug], new ApiClientError('Produto não encontrado', 'NOT_FOUND', 404))
  } else if (options?.product) {
    client.setQueryData(['product', slug], options.product)
  }
  if (options?.related) client.setQueryData(['products', 'related', PRODUCT.category.slug], options.related)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/product/${slug}`]}>
        <Routes>
          <Route path="/product/:slug" element={<Product />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Product — carregando', () => {
  it('exibe skeleton com a estrutura da página', () => {
    const html = renderProduct(PRODUCT.slug)
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(4)
  })
})

describe('Product — encontrado', () => {
  const html = renderProduct(PRODUCT.slug, { product: PRODUCT, related: RELATED })

  it('renderiza título, condição, vendidos e avaliação', () => {
    expect(html).toContain('Aspirador De Pó E Água Wap Gtw 10')
    expect(html).toContain('100.000 vendidos')
    expect(html).toContain('Novo')
    expect(html).toContain('4,8')
    expect(html).toContain('(450 avaliações)')
  })

  it('renderiza breadcrumb com as categorias reais da API', () => {
    expect(html).toMatch(/href="\/search\?category=eletrodomesticos"/)
    expect(html).toMatch(/href="\/search\?category=aspiradores"/)
    expect(html).toContain('Eletrodomésticos')
  })

  it('renderiza galeria com imagem principal e miniaturas', () => {
    expect(html).toMatch(/src="https:\/\/picsum\.photos\/seed\/wap-1\/800\/800"/)
    expect(html).toContain('Ver imagem 2 de 2')
    expect(html).toContain('aria-current="true"')
  })

  it('renderiza preço com desconto e parcelamento derivado', () => {
    expect(html).toContain('R$ 259,90')
    expect(html).toMatch(/R\$ 399,00/)
    expect(html).toContain('35% OFF')
    expect(html).toContain('12x R$ 21,66')
  })

  it('renderiza variantes com a esgotada desabilitada', () => {
    expect(html).toContain('Voltagem:')
    expect(html).toContain('127V')
    expect(html).toMatch(/disabled=""[^>]*>220V</)
    expect(html).toContain('Disponível: 51 unidades')
  })

  it('renderiza botões de compra e o aviso de carrinho só após interação', () => {
    expect(html).toContain('Comprar agora')
    expect(html).toContain('Adicionar ao carrinho')
    expect(html).not.toContain('Carrinho em breve')
  })

  it('renderiza descrição, informações e relacionados (excluindo o próprio produto)', () => {
    expect(html).toContain('Descrição')
    expect(html).toContain('Marca')
    expect(html).toContain('Produtos relacionados')
    expect(html).toMatch(/href="\/product\/aspirador-robot"/)
  })
})

describe('Product — estados de erro', () => {
  it('produto inexistente (404) mostra empty state com volta', () => {
    const html = renderProduct('nao-existe', { product: 'error404' })
    expect(html).toContain('Produto não encontrado')
    expect(html).toContain('Voltar')
    expect(html).not.toContain('Comprar agora')
  })

  it('erro de API mostra ErrorState com retry', () => {
    const html = renderProduct(PRODUCT.slug, { product: 'error' })
    expect(html).toContain('Não conseguimos carregar o produto.')
    expect(html).toContain('Tentar novamente')
  })
})

describe('helpers da PDP', () => {
  it('variantAttributeGroups agrupa atributos por nome com opções únicas', () => {
    expect(variantAttributeGroups(PRODUCT.variants)).toEqual([
      {
        name: 'Voltagem',
        options: [
          { value: '127V', variantId: 'v1', stock: 51 },
          { value: '220V', variantId: 'v2', stock: 0 },
        ],
      },
    ])
  })

  it('variantAttributeGroups retorna vazio para produto simples', () => {
    expect(variantAttributeGroups([{ id: 'v1', attributes: {}, price: 100, stock: 5 }])).toEqual([])
  })

  it('clampQuantity limita entre 1 e o estoque', () => {
    expect(clampQuantity(0, 10)).toBe(1)
    expect(clampQuantity(5, 3)).toBe(3)
    expect(clampQuantity(2, 10)).toBe(2)
    expect(clampQuantity(-1, 0)).toBe(1)
  })
})
