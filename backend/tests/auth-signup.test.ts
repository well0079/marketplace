import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

const suffix = Date.now()
const EMAIL = `cadastro.${suffix}@teste.com`
const PASSWORD = 'Senha1@segura'
const CPF = '529.982.247-25'
const CPF_DIGITS = '52998224725'
const PHONE_OK = '(11) 98765-4321'
const PHONE_E164 = '+5511987654321'

const cleanupEmails = [EMAIL, `antigo.${suffix}@teste.com`, `outro.${suffix}@teste.com`, `madonna.${suffix}@teste.com`, `outro.cadastro.${suffix}@teste.com`]
cleanupEmails.push(`invalido.${suffix}.0@teste.com`, `invalido.${suffix}.1@teste.com`, `invalido.${suffix}.2@teste.com`, `invalido.${suffix}.3@teste.com`)

let modeBackup: string | undefined

beforeEach(() => {
  modeBackup = process.env.PHONE_VERIFICATION_MODE
  process.env.PHONE_VERIFICATION_MODE = 'off'
  // limite alto por padrão nos testes de fluxo (o teste de rate limit ajusta e restaura)
  process.env.SIGNUP_RATE_LIMIT = '1000'
})

afterAll(async () => {
  process.env.PHONE_VERIFICATION_MODE = modeBackup
  // limpeza: desafios, usuários criados e dependentes leves
  const users = await prisma.user.findMany({ where: { email: { in: cleanupEmails } } })
  for (const user of users) {
    await prisma.reservation.deleteMany({ where: { userId: user.id } })
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } })
    await prisma.cart.deleteMany({ where: { userId: user.id } })
    await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } })
    await prisma.paymentEvent.deleteMany({ where: { payment: { order: { userId: user.id } } } })
    await prisma.payment.deleteMany({ where: { order: { userId: user.id } } })
    await prisma.order.deleteMany({ where: { userId: user.id } })
  }
  await prisma.signupChallenge.deleteMany({ where: { phone: { startsWith: '+5511' } } })
  await prisma.user.deleteMany({ where: { email: { in: cleanupEmails } } })
  await prisma.$disconnect()
})

async function startSignup(phone = PHONE_OK) {
  return request(app).post('/api/v1/auth/signup/start').send({ phone })
}

async function runOffSignup() {
  const start = await startSignup()
  expect(start.status).toBe(201)
  return start.body.token as string
}

describe('POST /auth/signup/start', () => {
  it('modo off: nextStep account, sem código, token emitido', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'off'
    const res = await startSignup()
    expect(res.status).toBe(201)
    expect(res.body.nextStep).toBe('account')
    expect(res.body.token).toBeTruthy()
    expect(res.body.code).toBeUndefined()
    expect(res.body.demo).toBeUndefined()
  })

  it('modo demo: código de 6 dígitos no corpo com demo:true', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'demo'
    const res = await startSignup()
    expect(res.status).toBe(201)
    expect(res.body.nextStep).toBe('verify')
    expect(res.body.demo).toBe(true)
    expect(res.body.code).toMatch(/^\d{6}$/)
  })

  it('modo sms → 501 explícito (nunca finge envio)', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'sms'
    const res = await startSignup()
    expect(res.status).toBe(501)
    expect(res.body.error.code).toBe('SMS_NOT_AVAILABLE')
  })

  it('celular inválido → 400 por campo; celular já cadastrado não é revelado aqui', async () => {
    const bad = await startSignup('123456')
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields.phone).toBeTruthy()
  })

  it('armazena o celular em E.164', async () => {
    await startSignup(PHONE_OK)
    const challenge = await prisma.signupChallenge.findFirst({ where: { phone: PHONE_E164 }, orderBy: { createdAt: 'desc' } })
    expect(challenge).toBeTruthy()
  })
})

describe('POST /auth/signup/verify', () => {
  it('modo demo: código certo → ok', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'demo'
    const start = await startSignup()
    const verify = await request(app).post('/api/v1/auth/signup/verify').send({ token: start.body.token, code: start.body.code })
    expect(verify.status).toBe(200)
    expect(verify.body.ok).toBe(true)
  })

  it('código errado → 400 com tentativas restantes; 5 erros → 429', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'demo'
    const start = await startSignup()
    const token = start.body.token
    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = await request(app).post('/api/v1/auth/signup/verify').send({ token, code: '000000' })
      if (attempt < 4) {
        expect(wrong.status).toBe(400)
        expect(wrong.body.error.message).toContain('restante')
      }
    }
    const sixth = await request(app).post('/api/v1/auth/signup/verify').send({ token, code: start.body.code }) // até o certo é bloqueado
    expect(sixth.status).toBe(429)
    expect(sixth.body.error.code).toBe('TOO_MANY_ATTEMPTS')
  })

  it('token inválido → 400', async () => {
    const res = await request(app).post('/api/v1/auth/signup/verify').send({ token: 'abc.def.ghi.jkl', code: '123456' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('SIGNUP_TOKEN_INVALID')
  })
})

describe('POST /auth/signup/complete', () => {
  it('fluxo completo (off): cria usuário, abre sessão e me() traz cpfMasked', async () => {
    const token = await runOffSignup()
    const res = await request(app).post('/api/v1/auth/signup/complete').send({
      token, name: 'Cadastro Ingressos', cpf: CPF, email: EMAIL, password: PASSWORD, marketing: true,
    })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe(EMAIL)
    expect(res.body.cpfMasked).toBe('***.982.247-**')
    // CPF COMPLETO nunca aparece em resposta nenhuma
    expect(res.text).not.toContain(CPF_DIGITS)
    expect(res.text).not.toContain(CPF)

    const setCookie = res.headers['set-cookie']
    const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c) => c.startsWith('auth_token='))
    expect(cookie).toBeTruthy()

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie as string)
    expect(me.status).toBe(200)
    expect(me.body.cpfMasked).toBe('***.982.247-**')
    expect(me.body.isSeller).toBe(false)

    const dbUser = await prisma.user.findUnique({ where: { email: EMAIL } })
    expect(dbUser?.phone).toBe(PHONE_E164)
    expect(dbUser?.cpfHash).toMatch(/^[0-9a-f]{64}$/)
    expect(dbUser?.marketingOptIn).toBe(true)
    // o hash não é reversível: o CPF completo não existe em nenhum campo
    expect(JSON.stringify(dbUser)).not.toContain(CPF_DIGITS)
  })

  it('CPF com dígito verificador inválido → 400', async () => {
    const token = await runOffSignup()
    const res = await request(app).post('/api/v1/auth/signup/complete').send({
      token, name: 'Cadastro Ingressos', cpf: '529.982.247-24', email: EMAIL, password: PASSWORD,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.cpf).toBeTruthy()
  })

  it('senha sem maiúscula/número/especial → 400 com a regra específica', async () => {
    const token = await runOffSignup()
    let caseIndex = 0
    for (const [badPassword, expectedSnippet] of [
      ['senhafraquinha1', 'maiúscula'],
      ['Senhafraquinha', 'número'],
      ['Senha1semespecial', 'especial'],
      ['Senha1ok', 'especial'],
    ] as const) {
      const uniqueEmail = `invalido.${suffix}.${caseIndex++}@teste.com`
      const res = await request(app).post('/api/v1/auth/signup/complete').send({
        token, name: 'Cadastro Ingressos', cpf: '177.862.437-55', email: uniqueEmail, password: badPassword,
      })
      expect(res.status).toBe(400)
      expect(res.body.error.fields.password).toContain(expectedSnippet)
    }
  })

  it('nome com uma palavra → 400', async () => {
    const token = await runOffSignup()
    const res = await request(app).post('/api/v1/auth/signup/complete').send({
      token, name: 'Madonna', cpf: '650.258.665-10', email: `madonna.${suffix}@teste.com`, password: PASSWORD,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.name).toBeTruthy()
  })

  it('duplicidade (e-mail/CPF/celular) → 409 GENÉRICO sem dizer o campo', async () => {
    // celular exclusivo: o unique de celular é por usuário (PHONE_OK pertence ao fluxo completo)
    process.env.PHONE_VERIFICATION_MODE = 'off'
    const startA = await startSignup('(21) 91234-5678')
    const tokenA = startA.body.token
    const originalEmail = `original.${suffix}@teste.com`
    cleanupEmails.push(originalEmail)
    // CPF exclusivo deste teste (o CPF "CPF" já pertence ao usuário do fluxo completo)
    const created = await request(app).post('/api/v1/auth/signup/complete').send({
      token: tokenA, name: 'Cadastro Ingressos', cpf: '177.862.437-55', email: originalEmail, password: PASSWORD,
    })
    expect(created.status).toBe(201)

    // novo fluxo com outro celular mas MESMO e-mail
    process.env.PHONE_VERIFICATION_MODE = 'off'
    const start2 = await startSignup('(11) 97654-3210')
    const dup = await request(app).post('/api/v1/auth/signup/complete').send({
      token: start2.body.token, name: 'Outro Cadastro', cpf: '177.862.437-55', email: originalEmail, password: PASSWORD,
    })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('ACCOUNT_CREATE_FAILED')
    expect(dup.body.error.message).toContain('Se você já tem conta, entre.')
    // genérico: não fala em e-mail/CPF/celular
    expect(dup.body.error.message.toLowerCase()).not.toContain('e-mail')
    expect(dup.body.error.message.toLowerCase()).not.toContain('cpf')
    expect(dup.body.error.message.toLowerCase()).not.toContain('celular')

    // MESMO CPF com e-mail diferente → mesmo 409 genérico
    const start3 = await startSignup('(11) 96543-2109')
    const dupCpf = await request(app).post('/api/v1/auth/signup/complete').send({
      token: start3.body.token, name: 'Outro Cadastro', cpf: CPF, email: `outro.${suffix}@teste.com`, password: PASSWORD,
    })
    expect(dupCpf.status).toBe(409)
    expect(dupCpf.body.error.code).toBe('ACCOUNT_CREATE_FAILED')
  })

  it('complete sem verify (modo demo) → 422 PHONE_NOT_VERIFIED', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'demo'
    const start = await startSignup()
    const res = await request(app).post('/api/v1/auth/signup/complete').send({
      token: start.body.token, name: 'Cadastro Ingressos', cpf: CPF, email: EMAIL, password: PASSWORD,
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('PHONE_NOT_VERIFIED')
  })
})

describe('Login (e-mail ou celular) e usuário antigo', () => {
  it('usuário criado pelo /auth/register antigo (sem celular) continua logando', async () => {
    const old = { name: 'Usuário Antigo', email: `antigo.${suffix}@teste.com`, password: 'senha-segura-123' }
    const reg = await request(app).post('/api/v1/auth/register').send(old)
    expect(reg.status).toBe(201)

    const login = await request(app).post('/api/v1/auth/login').send({ email: old.email, password: old.password })
    expect(login.status).toBe(200)
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', authCookieFrom(login, 'auth_token'))
    expect(me.body.cpfMasked).toBeNull()
  })

  it('login por celular funciona (usuário do signup)', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: PHONE_OK, password: PASSWORD })
    expect(login.status).toBe(200)
    expect(login.body.email).toBe(EMAIL)
  })

  it('login com celular mascarado/em outros formatos também funciona', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: '+5511987654321', password: PASSWORD })
    expect(login.status).toBe(200)
  })

  it('falha de login continua genérica (401)', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: EMAIL, password: 'Errada1@x' })
    expect(login.status).toBe(401)
    expect(login.body.error.message).toBe('E-mail ou senha inválidos.')
  })
})

function authCookieFrom(res: request.Response, name: string): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = new RegExp(`${name}=([^;]+)`).exec(cookies.find((c) => c.startsWith(`${name}=`)) ?? '')
  if (!match) throw new Error(`cookie ${name} não foi emitido`)
  return `${name}=${match[1]}`
}

describe('Rate limit do signup (por IP)', () => {
  it('acima do limite configurado → 429', async () => {
    process.env.SIGNUP_RATE_LIMIT = '1'
    try {
      // o bucket deste IP já tem hits dos testes anteriores: o próximo já é 429
      const res = await startSignup('(11) 99111-2233')
      expect(res.status).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
    } finally {
      process.env.SIGNUP_RATE_LIMIT = '1000'
    }
  })
})
