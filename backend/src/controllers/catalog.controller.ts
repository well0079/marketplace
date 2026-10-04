import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { toInt } from '../lib/params'
import * as catalog from '../services/catalog.service'

const SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'newest'])

export async function getHealth(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'up' })
  } catch {
    res.status(503).json({ error: { code: 'DATABASE_DOWN', message: 'Banco de dados indisponível' } })
  }
}

export async function listProducts(req: Request, res: Response) {
  const page = toInt(req.query.page, 1, 1, 100_000)
  const limit = toInt(req.query.limit, 20, 1, 50)
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined
  const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : undefined
  const sort = typeof req.query.sort === 'string' && SORTS.has(req.query.sort) ? req.query.sort : 'relevance'

  const { items, total } = await catalog.listProducts({ q, category, sort, page, limit })
  res.json({ items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) })
}

export async function getProduct(req: Request, res: Response) {
  const slug = String(req.params.slug ?? '')
  const product = await catalog.getProductBySlug(slug)
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Produto não encontrado')
  res.json(product)
}

export async function getCategories(_req: Request, res: Response) {
  res.json(await catalog.listCategories())
}
