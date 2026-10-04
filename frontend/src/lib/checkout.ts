import { api } from './api'

export type Address = {
  id: string
  label: string | null
  recipient: string
  zipCode: string
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  state: string
  isDefault: boolean
}

export type ShippingOption = {
  id: 'standard' | 'express'
  label: string
  description: string
  price: number
}

export type ShippingQuote = { zipCode: string; region: string; options: ShippingOption[] }

export const ADDRESSES_QUERY_KEY = ['addresses'] as const

export function shippingQueryKey(zipCode: string) {
  return ['shipping', zipCode] as const
}

export const addressApi = {
  list: () => api.get<Address[]>('/addresses'),
  create: (input: AddressFormValues) => api.post<Address>('/addresses', input),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/addresses/${id}`),
}

export const shippingApi = {
  options: (zipCode: string) =>
    api.get<ShippingQuote>(`/shipping/options?zipCode=${encodeURIComponent(zipCode)}`),
}

export type AddressFormValues = {
  label: string
  recipient: string
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  label: '',
  recipient: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
}

// Mesma lista do servidor (address.controller) — fonte única para o Select e a validação
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// Mesmas regras do servidor (address.controller) — feedback imediato antes do POST
export function validateAddressForm(values: AddressFormValues): Record<string, string> | null {
  const fields: Record<string, string> = {}
  if (values.recipient.trim().length < 2) fields.recipient = 'Informe o nome de quem vai receber.'
  if (values.zipCode.replace(/\D/g, '').length !== 8) fields.zipCode = 'Informe um CEP válido com 8 dígitos.'
  if (values.street.trim().length < 2) fields.street = 'Informe a rua.'
  if (values.number.trim().length < 1) fields.number = 'Informe o número.'
  if (values.district.trim().length < 2) fields.district = 'Informe o bairro.'
  if (values.city.trim().length < 2) fields.city = 'Informe a cidade.'
  if (!UFS.includes(values.state.trim().toUpperCase())) fields.state = 'Selecione um estado válido.'
  return Object.keys(fields).length > 0 ? fields : null
}

// Máscara 00000-000 (o servidor também normaliza; aqui é só exibição)
export function formatZipCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function formatAddressStreetLine(address: Address): string {
  return `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ''}`
}

export function formatAddressCityLine(address: Address): string {
  return `${address.district}, ${address.city} - ${address.state} · CEP ${formatZipCode(address.zipCode)}`
}
