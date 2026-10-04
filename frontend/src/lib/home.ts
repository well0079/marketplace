import type { ProductCardData } from '../components/ecommerce/ProductCard'

export type CategoryNode = { id: string; name: string; slug: string; children: CategoryNode[] }

export type ProductsResponse = {
  items: ProductCardData[]
  page: number
  limit: number
  total: number
  totalPages: number
}

// Ofertas = produtos disponíveis com desconto, do maior percentual para o menor
export function pickOffers(products: ProductCardData[], max: number): ProductCardData[] {
  return products
    .filter((p) => !p.outOfStock && p.discountPercent != null && p.discountPercent > 0)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, max)
}

// Contrato de GET /api/v1/products: q, category (slug), sort, page, limit (máx. 50)
export const CATALOG_PAGE_SIZE = 12

export function buildCatalogParams(filters: { q?: string; category?: string; sort?: string; page: number }): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.sort) params.set('sort', filters.sort)
  params.set('page', String(filters.page))
  params.set('limit', String(CATALOG_PAGE_SIZE))
  return params
}

export function findCategoryName(nodes: CategoryNode[], slug: string): string | null {
  for (const node of nodes) {
    if (node.slug === slug) return node.name
    const found = findCategoryName(node.children, slug)
    if (found) return found
  }
  return null
}

// O filtro da API é por slug exato e o seed guarda produtos nas categorias folha;
// raízes com filhos são apenas agrupamentos.flatten das folhas = categorias filtráveis.
export function linkableCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? linkableCategories(node.children) : [node]))
}

// Contrato de GET /api/v1/products/:slug
export type ProductDetail = {
  id: string
  slug: string
  title: string
  description: string
  brand: string | null
  price: number
  originalPrice: number | null
  discountPercent: number | null
  freeShipping: boolean
  condition: string
  sold: number
  rating: { average: number; count: number }
  images: { url: string; alt: string | null }[]
  variants: { id: string; attributes: Record<string, string>; price: number; stock: number }[]
  category: { name: string; slug: string; breadcrumb: { name: string; slug: string }[] }
}

// Agrupa as variantes por nome de atributo (ex.: Voltagem → 127V/220V), na ordem de chegada
export function variantAttributeGroups(variants: ProductDetail['variants']): {
  name: string
  options: { value: string; variantId: string; stock: number }[]
}[] {
  const names: string[] = []
  for (const variant of variants) {
    for (const name of Object.keys(variant.attributes)) {
      if (!names.includes(name)) names.push(name)
    }
  }
  return names.map((name) => {
    const options = new Map<string, { value: string; variantId: string; stock: number }>()
    for (const variant of variants) {
      const value = variant.attributes[name]
      if (value == null || options.has(value)) continue
      options.set(value, { value, variantId: variant.id, stock: variant.stock })
    }
    return { name, options: [...options.values()] }
  })
}

// Quantidade sempre entre 1 e o estoque disponível (mínimo 1 mesmo sem estoque para habilitar UI)
export function clampQuantity(value: number, stock: number): number {
  return Math.min(Math.max(1, value), Math.max(1, stock))
}
