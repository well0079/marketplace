import { describe, expect, it } from 'vitest'
import {
  describeOrderError,
  formatOrderItemAttributes,
  orderStatusMeta,
  resolveIdempotencyKey,
  type ApiErrorLike,
} from './orders'
import { ApiClientError } from './api'

describe('resolveIdempotencyKey', () => {
  const keys = ['k1', 'k2', 'k3']
  const generate = () => keys.shift() ?? 'k0'

  it('sem lease anterior gera nova key', () => {
    const lease = resolveIdempotencyKey(null, 'addr|standard|v1:2', generate)
    expect(lease).toEqual({ signature: 'addr|standard|v1:2', key: 'k1' })
  })

  it('mesma assinatura (retry após erro de rede) reutiliza a key', () => {
    const keysRetry = ['k1']
    const generateRetry = () => keysRetry.shift() ?? 'k0'
    const first = resolveIdempotencyKey(null, 'addr|standard|v1:2', generateRetry)
    const retry = resolveIdempotencyKey(first, 'addr|standard|v1:2', generateRetry)
    expect(retry.key).toBe('k1')
    expect(retry.signature).toBe(first.signature)
  })

  it('mudou endereço/entrega/carrinho → nova key', () => {
    const changedKeys = ['a1', 'a2']
    const generateChanged = () => changedKeys.shift() ?? 'a0'
    const first = resolveIdempotencyKey(null, 'addr|standard|v1:2', generateChanged)
    const changed = resolveIdempotencyKey(first, 'addr|express|v1:2', generateChanged)
    expect(changed.key).toBe('a2')
    expect(changed.key).not.toBe(first.key)
    expect(changed.signature).toBe('addr|express|v1:2')
  })
})

describe('orderStatusMeta', () => {
  it('pending → "Aguardando pagamento" com badge warning', () => {
    expect(orderStatusMeta('pending')).toEqual({ label: 'Aguardando pagamento', badge: 'warning' })
  })

  it('cancelled → "Cancelado" com badge destructive', () => {
    expect(orderStatusMeta('cancelled')).toEqual({ label: 'Cancelado', badge: 'destructive' })
  })
})

describe('formatOrderItemAttributes', () => {
  it('junta atributos; vazio vira "Produto padrão"', () => {
    expect(formatOrderItemAttributes({ Cor: 'Azul', Tamanho: 'P' })).toBe('Cor: Azul · Tamanho: P')
    expect(formatOrderItemAttributes({})).toBe('Produto padrão')
  })
})

describe('describeOrderError', () => {
  it('STOCK_INSUFFICIENT expõe os itens com problema', () => {
    const error = new ApiClientError('Alguns itens não têm estoque suficiente.', 'STOCK_INSUFFICIENT', 422, {
      'produto-x': 'Estoque insuficiente: apenas 1 unidade(s) disponível(is)',
    })
    const result = describeOrderError(error)
    expect(result.kind).toBe('stock')
    expect(result.message).toContain('apenas 1')
  })

  it('CART_EMPTY aponta para o carrinho', () => {
    const error = new ApiClientError('Seu carrinho está vazio.', 'CART_EMPTY', 422)
    expect(describeOrderError(error).kind).toBe('cart-empty')
  })

  it('erro de rede vira mensagem genérica com retry', () => {
    const error = new ApiClientError('Sem conexão com o servidor.', 'NETWORK', 0)
    const result = describeOrderError(error)
    expect(result.kind).toBe('generic')
    expect(result.message).toContain('Sem conexão')
  })

  it('erro desconhecido não quebra a página', () => {
    expect(describeOrderError(new Error('boom')).kind).toBe('generic')
    expect(describeOrderError(undefined).kind).toBe('generic')
  })

  it('tipo ApiErrorLike é estrutural (não exige classe)', () => {
    const like: ApiErrorLike = { code: 'X', status: 400, message: 'x' }
    expect(describeOrderError(like).message).toBe('x')
  })
})
