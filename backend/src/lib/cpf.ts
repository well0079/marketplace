// Utilitários de CPF: validação de dígitos verificadores, formatação e máscara.
// O CPF completo NUNCA é persistido nem logado — só enviado à FastSoft e guardado mascarado.

export function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function formatCpf(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => [a, b, c].join('.') + (e ? `-${e}` : ''))
}

// ***.456.789-** — só o miolo fica legível; nunca guardar/logar o CPF completo
export function maskCpf(digits: string): string {
  const d = onlyDigits(digits)
  if (d.length !== 11) return '***.***.***-**'
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
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

// Regra oficial da Receita: dois dígitos verificadores (módulo 11); rejeita sequências
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return checkDigit(cpf.slice(0, 9)) === cpf[9] && checkDigit(cpf.slice(0, 10)) === cpf[10]
}

// Formato exibido nos exemplos da FastSoft: (11) 98765-4321 / (11) 3456-7890
export function formatPhone(digits: string): string {
  const d = onlyDigits(digits)
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return d
}

export function formatZipCode(digits: string): string {
  const d = onlyDigits(digits).slice(0, 8)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

import { createHash } from 'node:crypto'

// Hash do CPF para unicidade: sha256(cpf + pepper). O pepper vem de
// CPF_HASH_PEPPER; o fallback é só para dev e está DOCUMENTADO — em produção
// definir a env (a troca invalida hashes existentes).
function cpfPepper(): string {
  return process.env.CPF_HASH_PEPPER ?? 'dev-only-cpf-pepper-change-me'
}

export function hashCpf(digits: string): string {
  return createHash('sha256').update(onlyDigits(digits) + cpfPepper()).digest('hex')
}
