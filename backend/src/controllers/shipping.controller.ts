import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { readCartToken } from '../lib/cookies'
import { getCartByToken } from '../services/cart.service'
import { onlyZipDigits, shippingQuote } from '../services/shipping.service'

// Opções de entrega do carrinho do cookie (visitante ou logado) para o CEP informado
export async function getShippingOptions(req: Request, res: Response) {
  const zipCode = onlyZipDigits(req.query.zipCode)
  if (!zipCode) {
    throw new ApiError(400, 'VALIDATION', 'Informe um CEP válido com 8 dígitos.', { zipCode: 'CEP inválido.' })
  }

  const token = readCartToken(req)
  const cart = token ? await getCartByToken(token) : null
  const items = cart?.items.map((item) => ({ freeShipping: item.product.freeShipping })) ?? []

  res.json({ zipCode, ...shippingQuote(zipCode, items) })
}
