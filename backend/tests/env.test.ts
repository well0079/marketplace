import { describe, expect, it } from 'vitest'
import { assertProductionEnv, findProductionEnvProblems } from '../src/lib/env'

const BACKUP = { ...process.env }

describe('findProductionEnvProblems / assertProductionEnv', () => {
  it('fora de produção não valida (dev usa fallbacks)', () => {
    expect(() =>
      assertProductionEnv({ ...BACKUP, NODE_ENV: 'development', AUTH_SECRET: undefined }),
    ).not.toThrow()
    expect(findProductionEnvProblems({ NODE_ENV: 'development' })).toEqual([])
  })

  it('produção com fallbacks de dev → problemas detectados', () => {
    const problems = findProductionEnvProblems({
      NODE_ENV: 'production',
      AUTH_SECRET: 'dev-only-insecure-secret-change-me',
      CPF_HASH_PEPPER: 'dev-only-cpf-pepper-change-me',
    })
    expect(problems).toEqual([
      { name: 'AUTH_SECRET', reason: 'fallback-dev' },
      { name: 'CPF_HASH_PEPPER', reason: 'fallback-dev' },
    ])
  })

  it('produção sem as variáveis → ausentes', () => {
    const problems = findProductionEnvProblems({ NODE_ENV: 'production' })
    expect(problems.map((p) => p.name).sort()).toEqual(['AUTH_SECRET', 'CPF_HASH_PEPPER'])
  })

  it('produção com valores reais → sem problemas', () => {
    expect(
      findProductionEnvProblems({ NODE_ENV: 'production', AUTH_SECRET: 'segredo-forte', CPF_HASH_PEPPER: 'pimenta' }),
    ).toEqual([])
    expect(() =>
      assertProductionEnv({ NODE_ENV: 'production', AUTH_SECRET: 'segredo-forte', CPF_HASH_PEPPER: 'pimenta' }),
    ).not.toThrow()
  })
})
