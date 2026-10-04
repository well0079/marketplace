import { api, ApiClientError } from './api'

export type PublicUser = { id: string; name: string; email: string }

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
