import { api, ApiClientError } from './api'

export type PublicUser = { id: string; name: string; email: string; cpfMasked?: string | null; isSeller?: boolean }

export const AUTH_QUERY_KEY = ['auth', 'me'] as const

// A API retorna 401 quando não há sessão; para o frontend isso é apenas "sem usuário"
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    return await api.get<PublicUser>('/auth/me')
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null
    throw error
  }
}

export const authApi = {
  login: (email: string, password: string) => api.post<PublicUser>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<PublicUser>('/auth/register', { name, email, password }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', {}),
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLoginForm(values: { email: string; password: string }): Record<string, string> | null {
  const fields: Record<string, string> = {}
  if (!EMAIL_PATTERN.test(values.email.trim())) fields.email = 'Informe um e-mail válido.'
  if (values.password.length === 0) fields.password = 'Informe sua senha.'
  return Object.keys(fields).length > 0 ? fields : null
}

export function validateRegisterForm(values: {
  name: string
  email: string
  password: string
  confirmPassword: string
}): Record<string, string> | null {
  const fields: Record<string, string> = {}
  if (values.name.trim().length < 2) fields.name = 'Informe seu nome.'
  if (!EMAIL_PATTERN.test(values.email.trim())) fields.email = 'Informe um e-mail válido.'
  if (values.password.length < 8) fields.password = 'A senha deve ter pelo menos 8 caracteres.'
  if (values.confirmPassword !== values.password) fields.confirmPassword = 'As senhas não coincidem.'
  return Object.keys(fields).length > 0 ? fields : null
}

// ─── Cadastro em 3 passos (tema ingressos) — espelha as regras do backend ───

export type SignupStartPayload = { nextStep: 'verify' | 'account'; token: string; demo?: boolean; code?: string }

export const signupApi = {
  start: (phone: string) => api.post<SignupStartPayload>('/auth/signup/start', { phone }),
  verify: (token: string, code: string) => api.post<{ ok: boolean }>('/auth/signup/verify', { token, code }),
  complete: (input: { token: string; name: string; cpf: string; email: string; password: string; marketing: boolean }) =>
    api.post<PublicUser & { cpfMasked?: string; isSeller?: boolean }>('/auth/signup/complete', input),
  status: (token: string) => api.get<{ phone: string; verified: boolean; expired: boolean }>(`/auth/signup/status?token=${encodeURIComponent(token)}`),
}

// redirect seguro: só caminho relativo interno (começa com "/" e não com "//")
export function safeRedirect(param: string | null, fallback = '/'): string {
  if (!param) return fallback
  if (!param.startsWith('/') || param.startsWith('//') || param.includes('://')) return fallback
  return param
}

// Política de senha do backend, expressa como checklist para a UI
export function passwordChecklist(password: string): { label: string; ok: boolean }[] {
  return [
    { label: 'Pelo menos 8 caracteres', ok: password.length >= 8 },
    { label: '1 número', ok: /[0-9]/.test(password) },
    { label: '1 letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: '1 caractere especial', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'Sem espaço no início ou fim', ok: password.length === 0 || password === password.trim() },
  ]
}
