// Validação de ambiente em PRODUÇÃO: falha ao iniciar se segredos críticos
// estiverem ausentes ou usando o fallback de desenvolvimento.
export type EnvProblem = { name: string; reason: 'ausente' | 'fallback-dev' }

export function findProductionEnvProblems(env: Record<string, string | undefined>): EnvProblem[] {
  if (env.NODE_ENV !== 'production') return []
  const problems: EnvProblem[] = []
  const devFallbacks: [string, string][] = [
    ['AUTH_SECRET', 'dev-only-insecure-secret-change-me'],
    ['CPF_HASH_PEPPER', 'dev-only-cpf-pepper-change-me'],
  ]
  for (const [name, fallback] of devFallbacks) {
    const value = env[name]
    if (!value) problems.push({ name, reason: 'ausente' })
    else if (value === fallback) problems.push({ name, reason: 'fallback-dev' })
  }
  return problems
}

export function assertProductionEnv(env: Record<string, string | undefined> = process.env): void {
  if (process.env.NODE_ENV !== 'production') return
  const problems = findProductionEnvProblems(env)
  if (problems.length > 0) {
    const detail = problems.map((p) => `${p.name} (${p.reason})`).join(', ')
    throw new Error(`Variáveis de ambiente obrigatórias em produção: ${detail}`)
  }
}
