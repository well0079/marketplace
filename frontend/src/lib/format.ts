const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents: number): string {
  // pt-BR usa espaço inseparável (U+00A0/U+202F) após "R$"; normalizamos para espaço comum
  return brl.format(cents / 100).replace(/[\u00A0\u202F]/g, ' ')
}

// Hipótese de negócio (pendente de confirmação): 12x sem juros a partir de R$ 150
export function installments(cents: number): { count: number; amount: number } | null {
  if (cents < 15000) return null
  return { count: 12, amount: Math.ceil(cents / 12) }
}

export function discountPercent(price: number, originalPrice?: number | null): number | null {
  if (!originalPrice || originalPrice <= price) return null
  return Math.round((1 - price / originalPrice) * 100)
}
