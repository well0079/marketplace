import { ApiError } from './errors'
import { checkRateLimit, rateLimitFromEnv } from './rate-limit'

// wrapper que converte o sinal do limiter em ApiError 429 (mantém rate-limit.ts
// livre de dependência do Express para testes diretos)
export function enforceRateLimit(key: string, limit: number, code = 'RATE_LIMITED', message?: string): void {
  try {
    checkRateLimit(key, limit)
  } catch {
    throw new ApiError(429, code, message ?? 'Muitas tentativas. Aguarde um instante e tente de novo.')
  }
}

export { rateLimitFromEnv }
