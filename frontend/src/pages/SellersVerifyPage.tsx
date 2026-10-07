import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { AUTH_QUERY_KEY, fetchCurrentUser } from '../lib/auth'
import { BrandLogo } from '../components/ingressos/BrandLogo'
import { LegalStrip, AlertBanner } from '../components/ingressos/Footer'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ingressos/Controls'
import { Skeleton } from '../components/ui/Skeleton'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

type Address = { cep: string; uf: string; city: string; neighborhood: string; street: string; number: string; complement: string }
const EMPTY_ADDRESS: Address = { cep: '', uf: 'SP', city: '', neighborhood: '', street: '', number: '', complement: '' }

function maskCep(v: string) { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }

// /sellers/verify — 2 passos: identidade → endereço de cobrança → POST /sellers/verify → /sellers/new
export function SellersVerifyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })
  const [step, setStep] = useState<1 | 2>(1)
  const [consent, setConsent] = useState(false)
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [viacepError, setViacepError] = useState<string | null>(null)
  const [viacepLoading, setViacepLoading] = useState(false)

  useEffect(() => { document.title = 'Verificação de vendedor | Ingressos' }, [])

  if (meQuery.isPending) {
    return <main className="min-h-screen bg-ticket-surface-muted font-hanken"><Skeleton className="mx-auto mt-16 h-64 max-w-[420px] rounded-t-card" /></main>
  }
  if (!meQuery.data) {
    return <main className="min-h-screen bg-ticket-surface-muted font-hanken"><div className="mx-auto max-w-[420px] px-4 py-16"><EmptyState title="Entre para continuar" action={<Button size="sm" to="/login?redirect=%2Fsellers%2Fverify">Entrar</Button>} /></div></main>
  }

  const cpfMasked = meQuery.data.cpfMasked ?? 'não informado'

  function submitAddress() {
    setServerError(null)
    const errors: Record<string, string> = {}
    if (address.cep.replace(/\D/g, '').length !== 8) errors.cep = 'CEP deve ter 8 dígitos.'
    if (!UFS.includes(address.uf)) errors.uf = 'Selecione uma UF.'
    if (address.city.trim().length < 2) errors.city = 'Informe o município.'
    if (address.neighborhood.trim().length < 2) errors.neighborhood = 'Informe o bairro.'
    if (address.street.trim().length < 2) errors.street = 'Informe a rua.'
    if (address.number.trim().length < 1) errors.number = 'Informe o número.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSubmitting(true)
    fetch('/api/v1/sellers/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: true, address }),
    }).then(async (r) => {
      if (r.ok) { queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }); navigate('/sellers/new') }
      else { const body = await r.json(); setServerError(body?.error?.message ?? 'Erro ao verificar.') }
    }).catch(() => setServerError('Erro de conexão.')).finally(() => setSubmitting(false))
  }

  async function lookupCep() {
    const cep = address.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setViacepLoading(true); setViacepError(null)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      clearTimeout(timeout)
      const data = await r.json() as Record<string, string>
      if (data.erro === 'true') { setViacepError('CEP não encontrado. Preencha manualmente.'); return }
      setAddress((v) => ({ ...v, uf: data.uf ?? v.uf, city: data.localidade ?? v.city, neighborhood: data.bairro ?? v.neighborhood, street: data.logradouro ?? v.street }))
    } catch { setViacepError('Não foi possível consultar o CEP. Preencha manualmente.') }
    finally { setViacepLoading(false) }
  }

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="flex flex-col items-center px-4 pb-20 pt-6">
        <BrandLogo tone="dark" />
        <div className="mt-6 w-full max-w-[420px]">
          {/* PASSO 1 */}
          {step === 1 && (
            <>
              <h1 className="text-center font-lexend text-t-h1 text-ticket-text">Confirme sua identidade</h1>
              <p className="mt-2 text-center text-t-body-s text-ticket-muted">Por segurança: aqui ninguém é anônimo. Protegemos você e quem compra.</p>
              <ul className="mt-4 flex flex-col gap-2">
                <li className="flex items-center gap-2 text-t-body-s text-ticket-text"><span className="text-ticket-success">✓</span> Verificação só na sua primeira vez anunciando</li>
                <li className="flex items-center gap-2 text-t-body-s text-ticket-text"><span className="text-ticket-success">✓</span> É rápido e fácil</li>
              </ul>
              <div className="mt-4 flex items-center gap-2 rounded-t-control bg-ticket-surface2 px-3 py-2.5">
                <span aria-hidden>🔒</span>
                <span className="text-t-caption text-ticket-muted">
                  CPF: <span className="font-medium text-ticket-text">{cpfMasked}</span> — Este é o CPF vinculado à sua conta e recebimento de PIX.
                </span>
              </div>
              <label className="mt-4 flex items-start gap-2 text-t-caption text-ticket-muted">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5C4BF9]" />
                <span>Li e concordo com a verificação de identidade (<Link to="/privacy" className="underline">Política de dados LGPD</Link>)</span>
              </label>
            </>
          )}

          {/* PASSO 2 */}
          {step === 2 && (
            <>
              <h1 className="text-center font-lexend text-t-h1 text-ticket-text">Endereço de cobrança</h1>
              <p className="mt-2 text-center text-t-body-s text-ticket-muted">Entra na nota do seu repasse. Digite o CEP e a gente preenche o resto.</p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="CEP" inputMode="numeric" placeholder="00000-000" value={address.cep} error={fieldErrors.cep}
                      onChange={(e) => { setAddress((v) => ({ ...v, cep: maskCep(e.target.value) })); setViacepError(null) }} />
                  </div>
                  <button type="button" disabled={viacepLoading || address.cep.replace(/\D/g, '').length !== 8} onClick={() => void lookupCep()}
                    className="h-11 rounded-t-control bg-ticket-primary px-3 text-t-caption-strong text-on-ticket-white disabled:opacity-50">
                    {viacepLoading ? '…' : 'Buscar'}
                  </button>
                </div>
                {viacepError && <p className="text-t-caption text-ticket-warn">{viacepError}</p>}
                <div className="grid grid-cols-[80px_1fr] gap-3">
                  <Field label="UF" value={address.uf} error={fieldErrors.uf} onChange={(e) => setAddress((v) => ({ ...v, uf: e.target.value.toUpperCase() }))}>
                  </Field>
                  <Field label="Município" value={address.city} error={fieldErrors.city} onChange={(e) => setAddress((v) => ({ ...v, city: e.target.value }))} />
                </div>
                <Field label="Bairro" value={address.neighborhood} error={fieldErrors.neighborhood} onChange={(e) => setAddress((v) => ({ ...v, neighborhood: e.target.value }))} />
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <Field label="Endereço" value={address.street} error={fieldErrors.street} onChange={(e) => setAddress((v) => ({ ...v, street: e.target.value }))} />
                  <Field label="Nº" value={address.number} error={fieldErrors.number} onChange={(e) => setAddress((v) => ({ ...v, number: e.target.value }))} />
                </div>
                <Field label="Complemento (opcional)" value={address.complement} onChange={(e) => setAddress((v) => ({ ...v, complement: e.target.value }))} />
              </div>
            </>
          )}

          {serverError && (
            <div role="alert" className="mt-4 w-full rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">{serverError}</div>
          )}
        </div>

        {/* botões fixos no rodapé */}
        <div className="fixed inset-x-0 bottom-0 border-t border-ticket-hairline bg-surface px-4 pb-[env(safe-area-inset-bottom)] pt-3 pb-3">
          <div className="mx-auto flex max-w-[420px] items-center gap-3">
            {step === 1 ? (
              <>
                <button type="button" disabled={!consent || submitting} onClick={() => setStep(2)}
                  className="h-12 flex-1 rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:cursor-not-allowed disabled:opacity-50">
                  Confirmar identidade
                </button>
                <button type="button" onClick={() => navigate('/tickets')}
                  className="h-12 rounded-t-pill border border-ticket-border px-4 text-t-label text-ticket-text hover:bg-ticket-surface2">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={submitting} onClick={submitAddress}
                  className="h-12 flex-1 rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press disabled:opacity-50">
                  {submitting ? 'Salvando…' : 'Continuar'}
                </button>
                <button type="button" onClick={() => setStep(1)}
                  className="h-12 rounded-t-pill border border-ticket-border px-4 text-t-label text-ticket-text hover:bg-ticket-surface2">
                  ← Voltar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
