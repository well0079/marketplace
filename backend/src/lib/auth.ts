import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { prisma } from './prisma'
import { AUTH_COOKIE, readCookie } from './cookies'

// Autenticação sem dependências novas: hash scrypt (node:crypto) para senha e
// cookie de sessão assinado com HMAC-SHA256 (stateless; logout remove o cookie).
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30

function authSecret(): string {
  // Em produção definir AUTH_SECRET no ambiente; o fallback é apenas para dev
  return process.env.AUTH_SECRET ?? 'dev-only-insecure-secret-change-me'
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function sign(payload: string): string {
  return createHmac('sha256', authSecret()).update(payload).digest('hex')
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + SESSION_TTL}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expiresAt, signature] = parts
  const expected = sign(`${userId}.${expiresAt}`)
  const candidate = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (candidate.length !== expectedBuffer.length || !timingSafeEqual(candidate, expectedBuffer)) return null
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return null
  return userId
}

export type PublicUser = { id: string; name: string; email: string }

export async function getSessionUser(req: Request): Promise<PublicUser | null> {
  const userId = verifySessionToken(readCookie(req, AUTH_COOKIE))
  if (!userId) return null
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
}

// ─── Cadastro em 3 passos (tema ingressos) ───

const SIGNUP_TTL_MS = 30 * 60 * 1000
const SIGNUP_PURPOSE = 'signup'

// Token opaco e assinado (HMAC com AUTH_SECRET): carrega só o id do desafio +
// expiração — o código de verificação NUNCA trafega no token
export function createSignupToken(challengeId: string): string {
  const payload = `${SIGNUP_PURPOSE}.${challengeId}.${Date.now() + SIGNUP_TTL_MS}`
  return `${payload}.${sign(payload)}`
}

export function verifySignupToken(token: string | null | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== SIGNUP_PURPOSE) return null
  const [purpose, challengeId, expiresAt, signature] = parts
  const expected = sign(`${purpose}.${challengeId}.${expiresAt}`)
  const candidate = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (candidate.length !== expectedBuffer.length || !timingSafeEqual(candidate, expectedBuffer)) return null
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return null
  return challengeId
}

// Celular BR → E.164 (+55 + 10 ou 11 dígitos). Aceita formatos mascarados.
export function normalizeBrPhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (local.length !== 10 && local.length !== 11) return null
  if (local.length === 11 && local[2] !== '9') return null
  if (local.length === 10 && local[2] === '9') return null
  return `+55${local}`
}

// Política de senha: 8+, 1 número, 1 maiúscula, 1 especial, sem espaço no início/fim
export function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (password !== password.trim()) return 'A senha não pode começar ou terminar com espaço.'
  if (!/[0-9]/.test(password)) return 'A senha deve ter pelo menos 1 número.'
  if (!/[A-Z]/.test(password)) return 'A senha deve ter pelo menos 1 letra maiúscula.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'A senha deve ter pelo menos 1 caractere especial.'
  return null
}

// Nome: 2+ palavras
export function validateFullName(name: string): string | null {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.some((word) => word.length < 2)) return 'Informe seu nome completo (nome e sobrenome).'
  return null
}
