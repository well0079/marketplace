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
