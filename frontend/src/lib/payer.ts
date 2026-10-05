// Dados do pagador (Pix): máscaras e validação de CPF (dígito verificador) e telefone.
// Funções puras e testadas — o servidor revalida tudo (lib/cpf.ts no backend).

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function maskCpfInput(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function maskPhoneInput(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function checkDigit(base: string): string {
  let sum = 0
  let weight = base.length + 1
  for (const digit of base) {
    sum += Number(digit) * weight
    weight -= 1
  }
  const rest = (sum * 10) % 11
  return String(rest === 10 ? 0 : rest)
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return checkDigit(cpf.slice(0, 9)) === cpf[9] && checkDigit(cpf.slice(0, 10)) === cpf[10]
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value)
  return digits.length === 10 || digits.length === 11
}

export type PayerValues = { name: string; document: string; phone: string }

// Mesmas regras do servidor (payment.service.validatePayer)
export function validatePayerForm(values: PayerValues): Record<string, string> | null {
  const fields: Record<string, string> = {}
  if (values.name.trim().length < 2 || values.name.trim().length > 120) {
    fields.name = 'Informe o nome completo do pagador.'
  }
  if (!isValidCpf(values.document)) fields.document = 'Informe um CPF válido.'
  if (!isValidPhone(values.phone)) fields.phone = 'Informe um telefone com DDD.'
  return Object.keys(fields).length > 0 ? fields : null
}
