import { describe, expect, it } from 'vitest'
import { discountPercent, formatBRL, installments } from './format'

describe('formatBRL', () => {
  it('formata centavos em reais', () => expect(formatBRL(25990)).toBe('R$ 259,90'))
  it('formata zero', () => expect(formatBRL(0)).toBe('R$ 0,00'))
  it('formata milhares com separador', () => expect(formatBRL(123455)).toBe('R$ 1.234,55'))
})

describe('installments', () => {
  it('não parcela abaixo de R$ 150', () => expect(installments(14999)).toBeNull())
  it('parcela em 12x acima de R$ 150', () => expect(installments(25990)).toEqual({ count: 12, amount: 2166 }))
})

describe('discountPercent', () => {
  it('calcula percentual de desconto', () => expect(discountPercent(25990, 39900)).toBe(35))
  it('sem originalPrice retorna null', () => expect(discountPercent(25990, null)).toBeNull())
})
