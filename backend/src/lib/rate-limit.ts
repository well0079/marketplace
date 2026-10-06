// Rate limit simples em memória por chave (janela fixa). Usado nos endpoints de
// conta (signup/verify/complete/login). Limites configuráveis por env:
// SIGNUP_RATE_LIMIT e LOGIN_RATE_LIMIT (por minuto). Em produção com múltiplas
// instâncias, trocar por um store compartilhado (limitação documentada).
const WINDOW_MS = 60_000
const buckets = new Map<string, number[]>()

export function checkRateLimit(key: string, limit: number): void {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS)
  if (hits.length >= limit) {
    throw new Error('RATE_LIMITED')
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 50_000) buckets.clear()
}

export function rateLimitFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export { WINDOW_MS }
