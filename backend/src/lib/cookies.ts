import type { Request, Response } from 'express'

// Cookies do projeto: carrinho de convidado + sessão de autenticação.
// Leitura manual do header (sem cookie-parser); escrita via res.cookie do Express.
const CART_COOKIE = 'cart_token'
export const AUTH_COOKIE = 'auth_token'
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30
// Produção roda atrás de HTTPS (Vercel + trust proxy); dev local fica sem Secure
const IS_PROD = process.env.NODE_ENV === 'production'

const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: THIRTY_DAYS,
  ...(IS_PROD ? { secure: true } : {}),
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name && rest.length > 0) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

export function readCartToken(req: Request): string | null {
  return readCookie(req, CART_COOKIE)
}

export function setCartCookie(res: Response, token: string): void {
  res.cookie(CART_COOKIE, token, baseCookieOptions)
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, baseCookieOptions)
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/', ...(IS_PROD ? { secure: true } : {}) })
}
