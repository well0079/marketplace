import { describe, expect, it } from 'vitest'
import { isValidCpf, isValidPhone, maskCpfInput, maskPhoneInput, validatePayerForm } from './payer'

describe('maskCpfInput', () => {
  it('aplica a máscara progressiva 000.000.000-00', () => {
    expect(maskCpfInput('52998224725')).toBe('529.982.247-25')
    expect(maskCpfInput('529')).toBe('529')
    expect(maskCpfInput('529982')).toBe('529.982')
    expect(maskCpfInput('529982247')).toBe('529.982.247')
  })

  it('ignora não-dígitos e limita a 11', () => {
    expect(maskCpfInput('529.982.247-2599')).toBe('529.982.247-25')
  })
})

describe('maskPhoneInput', () => {
  it('mascara celular e fixo', () => {
    expect(maskPhoneInput('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhoneInput('1134567890')).toBe('(11) 3456-7890')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('rejeita DV errado, sequências e tamanhos inválidos', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})

describe('validatePayerForm', () => {
  const VALID = { name: 'Hugo Pagante', document: '529.982.247-25', phone: '(11) 98765-4321' }

  it('formulário válido retorna null', () => {
    expect(validatePayerForm(VALID)).toBeNull()
  })

  it('campos inválidos geram erro por campo', () => {
    const errors = validatePayerForm({ name: 'A', document: '111.111.111-11', phone: '123' })
    expect(errors?.name).toBeTruthy()
    expect(errors?.document).toBeTruthy()
    expect(errors?.phone).toBeTruthy()
  })
})

describe('isValidPhone', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true)
    expect(isValidPhone('(11) 3456-7890')).toBe(true)
    expect(isValidPhone('11')).toBe(false)
  })
})
