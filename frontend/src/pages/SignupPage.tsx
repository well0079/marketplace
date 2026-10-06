import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError } from '../lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_QUERY_KEY } from '../lib/auth'
import { passwordChecklist, safeRedirect, signupApi, type SignupStartPayload } from '../lib/auth'
import { isValidCpf, maskCpfInput, maskPhoneInput } from '../lib/payer'
import { cn } from '../lib/cn'
import { BrandLogo } from '../components/ingressos/BrandLogo'
import { Field } from '../components/ingressos/Controls'

// Cadastro em 3 passos (tema ingressos): celular → código (ou pulo) → conta.
// Estado em memória + token assinado do servidor; recarregar volta ao passo 1.
export function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [phone, setPhone] = useState('')
  const [startPayload, setStartPayload] = useState<SignupStartPayload | null>(null)
  const [code, setCode] = useState('')
  const [account, setAccount] = useState({ name: '', cpf: '', email: '', password: '', marketing: false })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const firstInvalidRef = useRef<HTMLDivElement>(null)

  const stepMeta: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Confirme seu celular', subtitle: 'A gente te manda um código pra confirmar' },
    2: { title: 'Digite o código', subtitle: 'Enviamos por SMS para o seu celular' },
    3: { title: 'Complete sua conta', subtitle: 'Falta pouco para comprar e vender ingressos' },
  }

  function gotoStep(next: 1 | 2 | 3) {
    setStep(next)
    setFieldErrors({})
    setServerError(null)
    window.scrollTo({ top: 0 })
  }

  const startMutation = useMutation({
    mutationFn: () => signupApi.start(phone),
    onSuccess: (payload) => {
      setStartPayload(payload)
      setCode('')
      gotoStep(payload.nextStep === 'account' ? 3 : 2)
    },
    onError: (error) => setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível iniciar o cadastro.'),
  })

  const verifyMutation = useMutation({
    mutationFn: (value: string) => signupApi.verify(startPayload!.token, value),
    onSuccess: () => gotoStep(3),
    onError: (error) => {
      if (error instanceof ApiClientError && (error.status === 400 || error.status === 422 || error.status === 429)) {
        setServerError(error.message)
      } else {
        setServerError('Não foi possível verificar o código.')
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: () =>
      signupApi.complete({
        token: startPayload!.token,
        name: account.name.trim(),
        cpf: account.cpf,
        email: account.email.trim().toLowerCase(),
        password: account.password,
        marketing: account.marketing,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user)
      navigate(redirect)
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields && Object.keys(error.fields).length > 0) {
        setFieldErrors(error.fields)
      } else {
        setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível criar a conta.')
      }
    },
  })

  function submitStart() {
    setServerError(null)
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      setFieldErrors({ phone: 'Informe um celular com DDD (10 ou 11 dígitos).' })
      return
    }
    setFieldErrors({})
    startMutation.mutate()
  }

  function submitVerify(codeToCheck = code) {
    setServerError(null)
    const digits = codeToCheck.replace(/\D/g, '')
    if (digits.length !== 6) {
      setFieldErrors({ code: 'Informe os 6 dígitos do código.' })
      return
    }
    setFieldErrors({})
    verifyMutation.mutate(digits)
  }

  function submitComplete() {
    setServerError(null)
    const errors: Record<string, string> = {}
    if (account.name.trim().split(/\s+/).filter(Boolean).length < 2) errors.name = 'Informe seu nome completo (nome e sobrenome).'
    if (!isValidCpf(account.cpf)) errors.cpf = 'Informe um CPF válido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) errors.email = 'Informe um e-mail válido.'
    const failing = passwordChecklist(account.password).filter((rule) => !rule.ok)
    if (failing.length > 0) errors.password = `Falta: ${failing.map((rule) => rule.label.toLowerCase()).join(', ')}.`
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      firstInvalidRef.current?.focus()
      return
    }
    completeMutation.mutate()
  }

  const busy = startMutation.isPending || verifyMutation.isPending || completeMutation.isPending
  const checklist = useMemo(() => passwordChecklist(account.password), [account.password])
  const allPasswordOk = checklist.every((rule) => rule.ok)

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="flex flex-col items-center px-4 pb-10 pt-6">
        <BrandLogo tone="dark" />

        <div className="mt-6 w-full max-w-[320px]">
          <div className="flex items-center justify-between text-t-nano text-ticket-muted">
            <span aria-live="polite">Passo {step} de 3</span>
            <span aria-hidden>{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-t-pill bg-ticket-hairline">
            <div className="h-full rounded-t-pill bg-ticket-primary transition-[width] duration-200" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        <div className="mt-6 flex w-full max-w-[320px] flex-col items-center text-center">
          <span aria-hidden className="mb-2 text-2xl">{step === 1 ? '📱' : step === 2 ? '✉️' : '🪪'}</span>
          <h1 className="font-lexend text-t-h1 text-ticket-text">{stepMeta[step].title}</h1>
          <p className="mt-1 text-t-body-s text-ticket-muted">{stepMeta[step].subtitle}</p>
        </div>

        {serverError && (
          <div role="alert" className="mt-4 w-full max-w-[320px] rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">
            {serverError}
          </div>
        )}

        <form
          className="mt-5 flex w-full max-w-[320px] flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 1) submitStart()
            else if (step === 2) submitVerify()
            else submitComplete()
          }}
          noValidate
        >
          {step === 1 && (
            <>
              <div className="flex items-end gap-2">
                <span aria-hidden className="flex h-11 items-center rounded-t-control border border-ticket-border bg-ticket-surface2 px-3 text-t-body text-ticket-muted">
                  +55
                </span>
                <div className="flex-1">
                  <Field
                    label="Celular"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    error={fieldErrors.phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-t-caption text-ticket-muted">A gente te manda um código pra confirmar.</p>
              <SubmitButton label={startMutation.isPending ? 'Enviando…' : 'Continuar'} disabled={busy} />
            </>
          )}

          {step === 2 && (
            <>
              {startPayload?.demo && (
                <div role="status" className="rounded-t-control border border-ticket-primary-outline bg-ticket-primary-soft px-3 py-2 text-center text-t-caption text-ticket-primary">
                  <span className="font-semibold">Modo demonstração:</span> use o código{' '}
                  <span className="font-sora text-t-label-strong">{startPayload.code}</span>
                </div>
              )}
              <CodeInput
                error={fieldErrors.code}
                onComplete={(value) => {
                  setCode(value)
                  submitVerify(value)
                }}
                onChange={setCode}
              />
              <SubmitButton label={verifyMutation.isPending ? 'Verificando…' : 'Confirmar código'} disabled={busy} />
              <ResendLink phone={phone} onResent={(payload) => setStartPayload(payload)} />
            </>
          )}

          {step === 3 && (
            <>
              <Field
                label="Nome completo"
                autoComplete="name"
                placeholder="Nome e sobrenome"
                value={account.name}
                error={fieldErrors.name}
                onChange={(e) => setAccount((v) => ({ ...v, name: e.target.value }))}
              />
              <Field
                label="CPF"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={account.cpf}
                error={fieldErrors.cpf}
                onChange={(e) => setAccount((v) => ({ ...v, cpf: maskCpfInput(e.target.value) }))}
              />
              <div className="rounded-t-control bg-ticket-primary-soft px-3 py-2 text-t-caption text-ticket-primary" role="note">
                Seu CPF confirma que é você e protege sua conta contra vendas falsas. Ele fica guardado
                de forma protegida e nunca aparece completo no site.
              </div>
              <Field
                label="E-mail"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={account.email}
                error={fieldErrors.email}
                onChange={(e) => setAccount((v) => ({ ...v, email: e.target.value }))}
              />
              <div>
                <div className="relative">
                  <Field
                    label="Senha"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Sua senha"
                    value={account.password}
                    error={fieldErrors.password}
                    onChange={(e) => setAccount((v) => ({ ...v, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[38px] text-t-caption text-ticket-muted"
                  >
                    <span aria-hidden>{showPassword ? '🙈' : '👁️'}</span>
                  </button>
                </div>
                <ul className="mt-2 flex flex-col gap-0.5" aria-live="polite">
                  {checklist.map((rule) => (
                    <li key={rule.label} className={cn('flex items-center gap-1 text-t-nano', rule.ok ? 'text-ticket-success' : 'text-ticket-faint')}>
                      <span aria-hidden>{rule.ok ? '✓' : '○'}</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
              <label className="flex items-center gap-2 text-t-caption text-ticket-muted">
                <input
                  type="checkbox"
                  checked={account.marketing}
                  onChange={(e) => setAccount((v) => ({ ...v, marketing: e.target.checked }))}
                  className="h-4 w-4 rounded border-ticket-border accent-[#5C4BF9]"
                />
                Quero receber novidades e ofertas (opcional)
              </label>
              <div ref={firstInvalidRef} tabIndex={-1} aria-live="polite" className="sr-only">
                {Object.values(fieldErrors)[0] ?? ''}
              </div>
              <SubmitButton label={completeMutation.isPending ? 'Criando conta…' : 'Criar conta'} disabled={busy || !allPasswordOk} />
            </>
          )}
        </form>

        <p className="mt-4 text-center text-t-caption text-ticket-muted">
          Já tem conta?{' '}
          <Link to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-medium text-ticket-primary hover:underline">
            Entrar
          </Link>
        </p>
        {step > 1 && (
          <button
            type="button"
            onClick={() => gotoStep((step - 1) as 1 | 2)}
            className="mt-2 text-t-caption text-ticket-muted hover:text-ticket-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline"
          >
            ← Voltar
          </button>
        )}
        <p className="mt-6 max-w-[320px] text-center text-t-nano text-ticket-faint">
          Ao criar a conta você concorda com os{' '}
          <Link to="/terms" className="underline hover:text-ticket-primary">Termos de uso</Link> e a{' '}
          <Link to="/privacy" className="underline hover:text-ticket-primary">Política de privacidade</Link>.
        </p>
      </div>
    </main>
  )
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 h-12 w-full rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

// Passo 2: 6 caixas com autofoco, colar e auto-submit
function CodeInput({ error, onComplete, onChange }: { error?: string; onComplete: (value: string) => void; onChange: (value: string) => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '')
    const next = [...digits]
    if (clean.length > 1) {
      for (let i = 0; i < 6; i++) next[i] = clean[i] ?? ''
    } else {
      next[index] = clean
    }
    setDigits(next)
    onChange(next.join(''))
    if (next.join('').length === 6) {
      onComplete(next.join(''))
    } else if (clean.length > 0 && index < 5) {
      refs.current[index + 1]?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-t-label text-ticket-text">Código de 6 dígitos</span>
      <div className="flex gap-1.5" role="group" aria-label="Código de 6 dígitos">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el
            }}
            inputMode="numeric"
            maxLength={6}
            aria-label={`Dígito ${index + 1} do código`}
            value={digit}
            onChange={(e) => setDigit(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus()
            }}
            className={cn(
              'h-12 w-10 rounded-t-control border bg-surface text-center font-sora text-t-h2 text-ticket-text focus:outline-none focus:ring-2',
              error ? 'border-ticket-danger ring-2 ring-ticket-danger-soft' : 'border-ticket-border focus:border-ticket-primary focus:ring-ticket-primary-outline',
            )}
          />
        ))}
      </div>
      {error && <p className="text-t-caption text-ticket-danger">{error}</p>}
    </div>
  )
}

// Reenvio com contagem de 30s — cria um NOVO desafio; o pai troca o token/código
function ResendLink({ phone, onResent }: { phone: string; onResent: (payload: SignupStartPayload) => void }) {
  const [seconds, setSeconds] = useState(30)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [seconds])

  const resendMutation = useMutation({
    mutationFn: () => signupApi.start(phone),
    onSuccess: (payload) => {
      setSeconds(30)
      onResent(payload)
    },
  })

  return (
    <button
      type="button"
      disabled={seconds > 0 || resendMutation.isPending}
      onClick={() => resendMutation.mutate()}
      className="text-t-caption text-ticket-primary hover:underline disabled:text-ticket-faint disabled:no-underline"
    >
      {resendMutation.isPending ? 'Reenviando…' : seconds > 0 ? `Reenviar código em ${seconds}s` : 'Reenviar código'}
    </button>
  )
}
