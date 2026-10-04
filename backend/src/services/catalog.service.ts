import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type ProductCardRow = Prisma.ProductGetPayload<{ include: { images: true } }>

function discountOf(price: number, originalPrice: number | null): number | null {
  if (originalPrice === null || originalPrice <= price) return null
  return Math.round((1 - price / originalPrice) * 100)
}

function toCard(p: ProductCardRow) {
  return {
    id: p.id, slug: p.slug, title: p.title, price: p.price,
    originalPrice: p.originalPrice,
    discountPercent: discountOf(p.price, p.originalPrice),
    freeShipping: p.freeShipping,
    rating: { average: p.ratingAvg, count: p.ratingCount },
    sold: p.soldCount,
    thumbnail: p.images[0]?.url ?? null,
  }
}

export async function listProducts(opts: { q?: string; category?: string; sort: string; page: number; limit: number }) {
  const where: Prisma.ProductWhereInput = { status: 'active' }
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: 'insensitive' } },
      { brand: { contains: opts.q, mode: 'insensitive' } },
    ]
  }
  if (opts.category) where.category = { slug: opts.category }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    opts.sort === 'price_asc' ? { price: 'asc' }
    : opts.sort === 'price_desc' ? { price: 'desc' }
    : opts.sort === 'newest' ? { createdAt: 'desc' }
    : { soldCount: 'desc' }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.product.count({ where }),
  ])

  return { items: rows.map(toCard), total }
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'active' },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { where: { active: true }, orderBy: { createdAt: 'asc' } },
      category: true,
    },
  })
  if (!product) return null

  const breadcrumb: { name: string; slug: string }[] = []
  let current: { id: string; name: string; slug: string; parentId: string | null } | null = product.category
  while (current) {
    breadcrumb.unshift({ name: current.name, slug: current.slug })
    current = current.parentId
      ? await prisma.category.findUnique({ where: { id: current.parentId } })
      : null
  }

  return {
    id: product.id, slug: product.slug, title: product.title,
    description: product.description, brand: product.brand,
    price: product.price, originalPrice: product.originalPrice,
    discountPercent: discountOf(product.price, product.originalPrice),
    freeShipping: product.freeShipping, condition: product.condition,
    sold: product.soldCount,
    rating: { average: product.ratingAvg, count: product.ratingCount },
    images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: product.variants.map((x) => ({
      id: x.id,
      attributes: x.attributes as Record<string, string>,
      price: x.priceOverride ?? product.price,
      stock: x.stock,
    })),
    category: { name: product.category.name, slug: product.category.slug, breadcrumb },
  }
}

export async function listCategories() {
  const all = await prisma.category.findMany({ orderBy: { position: 'asc' } })
  type Node = { id: string; name: string; slug: string; children: Node[] }
  const nodes = new Map<string, Node>(all.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, children: [] }]))
  const roots: Node[] = []
  for (const c of all) {
    const node = nodes.get(c.id)
    const parent = c.parentId ? nodes.get(c.parentId) : undefined
    if (node && parent) parent.children.push(node)
    else if (node) roots.push(node)
  }
  return roots
}
