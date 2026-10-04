import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { readCartToken, setAuthCookie, clearAuthCookie } from '../lib/cookies'
import { createSessionToken, hashPassword, verifyPassword, getSessionUser } from '../lib/auth'
import { mergeGuestCartForUser } from '../services/cart.service'
import { prisma } from '../lib/prisma'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export async function register(req: Request, res: Response) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  const fields: Record<string, string> = {}
  if (name.length < 2) fields.name = 'Informe seu nome completo.'
  if (!EMAIL_PATTERN.test(email)) fields.email = 'Informe um e-mail válido.'
  if (password.length < 8) fields.password = 'A senha deve ter pelo menos 8 caracteres.'
  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, 'VALIDATION', 'Verifique os campos do formulário.', fields)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new ApiError(409, 'EMAIL_IN_USE', 'Este e-mail já está cadastrado.')

  const user = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password) },
    select: { id: true, name: true, email: true },
  })

  await mergeGuestCartForUser(readCartToken(req), user.id, res)
  setAuthCookie(res, createSessionToken(user.id))
  // usuário direto no corpo (mesmo formato de /auth/me)
  res.status(201).json(user)
}

export async function login(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) {
    throw new ApiError(400, 'VALIDATION', 'Informe e-mail e senha.')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  // Erro genérico: não revelar se o e-mail existe
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
  }

  await mergeGuestCartForUser(readCartToken(req), user.id, res)
  setAuthCookie(res, createSessionToken(user.id))
  res.json({ id: user.id, name: user.name, email: user.email })
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res)
  res.json({ ok: true })
}

export async function me(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  res.json(user)
}
