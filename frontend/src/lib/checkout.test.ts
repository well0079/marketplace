import { describe, expect, it } from 'vitest'
import {
  EMPTY_ADDRESS_FORM,
  formatAddressCityLine,
  formatAddressStreetLine,
  formatZipCode,
  validateAddressForm,
  type Address,
} from './checkout'

const VALID: Address = {
  id: 'a1',
  label: 'Casa',
  recipient: 'Ana Silva',
  zipCode: '01310000',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 42',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  isDefault: true,
}

describe('validateAddressForm', () => {
  it('formulário completo e válido retorna null', () => {
    expect(
      validateAddressForm({
        ...EMPTY_ADDRESS_FORM,
        recipient: 'Ana Silva',
        zipCode: '01310-000',
        street: 'Avenida Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toBeNull()
  })

  it('campos obrigatórios vazios geram erro por campo', () => {
    const errors = validateAddressForm(EMPTY_ADDRESS_FORM)
    expect(errors).toMatchObject({
      recipient: expect.any(String),
      zipCode: expect.any(String),
      street: expect.any(String),
      number: expect.any(String),
      district: expect.any(String),
      city: expect.any(String),
      state: expect.any(String),
    })
    // opcionais não geram erro
    expect(errors?.label).toBeUndefined()
    expect(errors?.complement).toBeUndefined()
  })

  it('CEP incompleto e estado inválido são rejeitados', () => {
    const errors = validateAddressForm({
      ...EMPTY_ADDRESS_FORM,
      recipient: 'Ana Silva',
      zipCode: '01310',
      street: 'Avenida Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'XX',
    })
    expect(errors?.zipCode).toBeTruthy()
    expect(errors?.state).toBeTruthy()
  })
})

describe('formatZipCode', () => {
  it('aplica a máscara 00000-000', () => {
    expect(formatZipCode('01310000')).toBe('01310-000')
  })

  it('ignora não-dígitos e limita a 8 caracteres', () => {
    expect(formatZipCode('01310-0009')).toBe('01310-000')
    expect(formatZipCode('0131')).toBe('0131')
  })
})

describe('linhas de endereço', () => {
  it('rua inclui número e complemento quando existe', () => {
    expect(formatAddressStreetLine(VALID)).toBe('Avenida Paulista, 1000 — Apto 42')
    expect(formatAddressStreetLine({ ...VALID, complement: null })).toBe('Avenida Paulista, 1000')
  })

  it('linha de cidade inclui bairro, cidade, UF e CEP mascarado', () => {
    expect(formatAddressCityLine(VALID)).toBe('Bela Vista, São Paulo - SP · CEP 01310-000')
  })
})
