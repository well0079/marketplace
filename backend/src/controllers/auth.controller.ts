import type { Request, Response } from 'express'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { ApiError } from '../lib/errors'
import { readCartToken, setAuthCookie, clearAuthCookie } from '../lib/cookies'
import {
  createSessionToken,
  createSignupToken,
  hashPassword,
  normalizeBrPhone,
  validateFullName,
  validatePassword,
  verifyPassword,
  verifySignupToken,
  getSessionUser,
} from '../lib/auth'
import { hashCpf, isValidCpf, maskCpf } from '../lib/cpf'
import { enforceRateLimit, rateLimitFromEnv } from '../lib/rate-limit-error'
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
  // fluxo antigo do marketplace: regra de senha simples (>= 8) — o cadastro novo
  // do tema ingressos usa a política estrita em signup/complete
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
  const identifierRaw = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!identifierRaw || !password) {
    throw new ApiError(400, 'VALIDATION', 'Informe e-mail (ou celular) e senha.')
  }

  // rate limit por IP + identificador (mensagem genérica na falha de credenciais)
  const ip = req.ip ?? 'desconhecido'
  enforceRateLimit(`login:ip:${ip}`, rateLimitFromEnv('LOGIN_RATE_LIMIT', 10))
  enforceRateLimit(`login:id:${identifierRaw.toLowerCase()}`, rateLimitFromEnv('LOGIN_RATE_LIMIT', 10), 'RATE_LIMITED', 'Muitas tentativas de acesso. Aguarde um instante.')

  // aceita e-mail OU celular (digits com/sem +55)
  let user = null
  if (identifierRaw.includes('@')) {
    user = await prisma.user.findUnique({ where: { email: identifierRaw.toLowerCase() } })
  } else {
    const phone = normalizeBrPhone(identifierRaw)
    if (phone) user = await prisma.user.findUnique({ where: { phone } })
  }

  // Erro genérico: não revelar se a conta existe
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
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  const full = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, cpfMasked: true },
  })
  if (!full) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  const isSeller = (await prisma.offer.count({ where: { sellerId: full.id } })) > 0
  res.json({ ...full, isSeller })
}

// ─── Cadastro em 3 passos (tema ingressos) ───

type VerificationMode = 'off' | 'demo' | 'sms'

function verificationMode(): VerificationMode {
  const mode = process.env.PHONE_VERIFICATION_MODE
  return mode === 'demo' || mode === 'sms' || mode === 'off' ? mode : 'off'
}

function codePepper(): string {
  return process.env.CPF_HASH_PEPPER ?? 'dev-only-cpf-pepper-change-me'
}

function hashSignupCode(code: string, challengeId: string): string {
  return createHash('sha256').update(`${challengeId}:${code}:${codePepper()}`).digest('hex')
}

// PASSO 1 — valida o celular e cria o desafio (assinado, 30 min, sem sessão)
export async function signupStart(req: Request, res: Response) {
  enforceRateLimit(`signup:ip:${req.ip ?? 'desconhecido'}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10))
  const phone = normalizeBrPhone(req.body?.phone)
  if (!phone) {
    throw new ApiError(400, 'VALIDATION', 'Informe um celular brasileiro válido.', { phone: 'Celular inválido (com DDD).' })
  }
  enforceRateLimit(`signup:phone:${phone}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10), 'RATE_LIMITED', 'Muitas tentativas com este celular. Aguarde um instante.')

  const challenge = await prisma.signupChallenge.create({
    data: { phone, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  })
  const token = createSignupToken(challenge.id)

  const mode = verificationMode()
  if (mode === 'sms') {
    // provedor de SMS fora do escopo: resposta explícita, nunca fingir envio
    res.status(501).json({
      error: { code: 'SMS_NOT_AVAILABLE', message: 'Verificação por SMS ainda não está disponível neste ambiente.' },
    })
    return
  }
  if (mode === 'demo') {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await prisma.signupChallenge.update({
      where: { id: challenge.id },
      data: { codeHash: hashSignupCode(code, challenge.id) },
    })
    // MODO DEMONSTRAÇÃO: o código volta no corpo para a UI exibir (nunca é um envio real)
    res.status(201).json({ nextStep: 'verify', token, demo: true, code })
    return
  }
  // mode off: celular aceito sem verificação — pula direto para a conta
  await prisma.signupChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } })
  res.status(201).json({ nextStep: 'account', token })
}

// PASSO 2 — confere o código (máx. 5 tentativas, expira em 10 min, tempo constante)
export async function signupVerify(req: Request, res: Response) {
  enforceRateLimit(`signup:ip:${req.ip ?? 'desconhecido'}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10))
  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\D/g, '') : ''
  const challengeId = verifySignupToken(token)
  if (!challengeId) throw new ApiError(400, 'SIGNUP_TOKEN_INVALID', 'Fluxo de cadastro inválido ou expirado. Comece novamente.')

  const challenge = await prisma.signupChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new ApiError(422, 'SIGNUP_EXPIRED', 'Fluxo de cadastro expirado. Comece novamente.')
  }
  if (challenge.verifiedAt) {
    res.json({ ok: true })
    return
  }
  if (!challenge.codeHash || code.length !== 6) {
    throw new ApiError(400, 'INVALID_CODE', 'Código incorreto.')
  }
  if (challenge.attempts >= 5) {
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Comece o cadastro novamente.')
  }

  const candidate = Buffer.from(hashSignupCode(code, challenge.id))
  const expected = Buffer.from(challenge.codeHash)
  const ok = candidate.length === expected.length && timingSafeEqual(candidate, expected)
  if (!ok) {
    await prisma.signupChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = Math.max(0, 4 - challenge.attempts)
    throw new ApiError(400, 'INVALID_CODE', `Código incorreto. ${remaining} tentativa(s) restante(s).`)
  }

  await prisma.signupChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  })
  res.json({ ok: true })
}

// PASSO 3 — valida os dados e cria a conta (sessão abre aqui)
export async function signupComplete(req: Request, res: Response) {
  enforceRateLimit(`signup:ip:${req.ip ?? 'desconhecido'}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10))
  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const cpf = typeof req.body?.cpf === 'string' ? req.body.cpf : ''
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const marketing = req.body?.marketing === true

  const challengeId = verifySignupToken(token)
  if (!challengeId) throw new ApiError(400, 'SIGNUP_TOKEN_INVALID', 'Fluxo de cadastro inválido ou expirado. Comece novamente.')
  const challenge = await prisma.signupChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new ApiError(422, 'SIGNUP_EXPIRED', 'Fluxo de cadastro expirado. Comece novamente.')
  }
  if (!challenge.verifiedAt) {
    throw new ApiError(422, 'PHONE_NOT_VERIFIED', 'Confirme seu celular antes de completar o cadastro.')
  }

  const fields: Record<string, string> = {}
  const nameError = validateFullName(name)
  if (nameError) fields.name = nameError
  const cpfDigits = cpf.replace(/\D/g, '')
  if (cpfDigits.length !== 11 || !isValidCpf(cpfDigits)) {
    fields.cpf = 'Informe um CPF válido.'
  }
  if (!EMAIL_PATTERN.test(email)) fields.email = 'Informe um e-mail válido.'
  const passwordError = validatePassword(password)
  if (passwordError) fields.password = passwordError
  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, 'VALIDATION', 'Verifique os campos do formulário.', fields)
  }

  const cpfHashValue = hashCpf(cpfDigits)
  const cpfMaskedValue = maskCpf(cpfDigits)
  const phone = challenge.phone

  // Unicidade de celular/e-mail/CPF SEM revelar qual campo já existe
  const conflicts = await prisma.$transaction(async (tx) => {
    const byEmail = await tx.user.findUnique({ where: { email } })
    const byCpf = await tx.user.findUnique({ where: { cpfHash: cpfHashValue } })
    const byPhone = await tx.user.findUnique({ where: { phone } })
    return Boolean(byEmail || byCpf || byPhone)
  })
  if (conflicts) {
    throw new ApiError(409, 'ACCOUNT_CREATE_FAILED', 'Não foi possível criar a conta com esses dados. Se você já tem conta, entre.')
  }

  let user
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        phone,
        phoneVerifiedAt: challenge.verifiedAt,
        cpfMasked: cpfMaskedValue,
        cpfHash: cpfHashValue,
        marketingOptIn: marketing,
      },
      select: { id: true, name: true, email: true, cpfMasked: true },
    })
  } catch {
    // corrida com unique concorrente: mesma resposta genérica
    throw new ApiError(409, 'ACCOUNT_CREATE_FAILED', 'Não foi possível criar a conta com esses dados. Se você já tem conta, entre.')
  }

  await prisma.signupChallenge.update({ where: { id: challenge.id }, data: { expiresAt: new Date() } })
  await mergeGuestCartForUser(readCartToken(req), user.id, res)
  setAuthCookie(res, createSessionToken(user.id))
  res.status(201).json({ ...user, isSeller: false })
}

// valida o token de cadastro sem expor detalhes (usado pelo frontend para retomar passo)
export async function signupStatus(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const challengeId = verifySignupToken(token)
  if (!challengeId) throw new ApiError(400, 'SIGNUP_TOKEN_INVALID', 'Fluxo de cadastro inválido ou expirado. Comece novamente.')
  const challenge = await prisma.signupChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new ApiError(422, 'SIGNUP_EXPIRED', 'Fluxo de cadastro expirado. Comece novamente.')
  }
  res.json({
    phone: challenge.phone,
    verified: Boolean(challenge.verifiedAt),
    expired: challenge.expiresAt < new Date(),
  })
}
