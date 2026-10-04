// Regras de frete do marketplace (hipótese de negócio documentada, como installments()
// no frontend): preço e prazo pela região do CEP; a opção Normal é grátis quando TODOS
// os itens do carrinho são frete grátis (banda "frete grátis" do produto).

export type ShippingOption = {
  id: 'standard' | 'express'
  label: string
  description: string
  price: number
}

export type ShippingQuote = { region: string; options: ShippingOption[] }

type RegionRules = {
  region: string
  standard: number
  standardEta: [number, number]
  express: number
  expressEta: [number, number]
}

// Prefixos postais reais agrupados em três faixas: 0–3 Sudeste, 4–6 Norte/Nordeste,
// 7–9 Centro-Oeste/Sul
const REGIONS: Record<string, RegionRules> = {
  southeast: { region: 'Sudeste', standard: 1990, standardEta: [3, 6], express: 3990, expressEta: [1, 2] },
  northNortheast: { region: 'Norte e Nordeste', standard: 2990, standardEta: [5, 10], express: 5990, expressEta: [2, 4] },
  southCenterWest: { region: 'Sul e Centro-Oeste', standard: 2490, standardEta: [4, 8], express: 4990, expressEta: [2, 3] },
}

const DIGIT_TO_REGION: Record<string, RegionRules> = {
  '0': REGIONS.southeast,
  '1': REGIONS.southeast,
  '2': REGIONS.southeast,
  '3': REGIONS.southeast,
  '4': REGIONS.northNortheast,
  '5': REGIONS.northNortheast,
  '6': REGIONS.northNortheast,
  '7': REGIONS.southCenterWest,
  '8': REGIONS.southCenterWest,
  '9': REGIONS.southCenterWest,
}

export function onlyZipDigits(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

export function shippingQuote(zipCode: string, items: { freeShipping: boolean }[]): ShippingQuote {
  const rules = DIGIT_TO_REGION[zipCode[0]] ?? REGIONS.southeast
  const allFreeShipping = items.length > 0 && items.every((item) => item.freeShipping)
  return {
    region: rules.region,
    options: [
      {
        id: 'standard',
        label: 'Normal',
        description: `Chega entre ${rules.standardEta[0]} e ${rules.standardEta[1]} dias úteis`,
        price: allFreeShipping ? 0 : rules.standard,
      },
      {
        id: 'express',
        label: 'Expressa',
        description: `Chega entre ${rules.expressEta[0]} e ${rules.expressEta[1]} dias úteis`,
        price: rules.express,
      },
    ],
  }
}
