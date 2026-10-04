import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { cartApi, CART_QUERY_KEY } from '../lib/cart'
import {
  ADDRESSES_QUERY_KEY,
  addressApi,
  EMPTY_ADDRESS_FORM,
  formatAddressCityLine,
  formatAddressStreetLine,
  formatZipCode,
  shippingApi,
  shippingQueryKey,
  validateAddressForm,
  UFS,
  type AddressFormValues,
  type ShippingOption,
} from '../lib/checkout'
import {
  ORDERS_QUERY_KEY,
  describeOrderError,
  newIdempotencyKey,
  ordersApi,
  resolveIdempotencyKey,
  type IdempotencyLease,
} from '../lib/orders'
import { formatBRL } from '../lib/format'
import { cn } from '../lib/cn'
import { Container } from '../components/layout/Container'
import { Alert } from '../components/ui/Alert'
import { AuthGate } from '../components/ui/AuthGate'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input } from '../components/ui/Input'
import { Radio } from '../components/ui/Radio'
import { Select } from '../components/ui/Select'
import { Separator } from '../components/ui/Separator'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'
import { PlusIcon, TrashIcon } from '../components/layout/icons'

function StepHeader({ step, title, done }: { step: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-small font-medium',
          done ? 'bg-success text-success-foreground' : 'bg-page text-muted-foreground',
        )}
      >
        {step}
      </span>
      <h2 className="text-h4 text-foreground">{title}</h2>
    </div>
  )
}

function AddressForm({
  values,
  fieldErrors,
  serverError,
  submitting,
  onValues,
  onSubmit,
  onCancel,
}: {
  values: AddressFormValues
  fieldErrors: Record<string, string>
  serverError: string | null
  submitting: boolean
  onValues: (values: AddressFormValues) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  function setField<K extends keyof AddressFormValues>(name: K) {
    return (event: { target: { value: string } }) => onValues({ ...values, [name]: event.target.value })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {serverError && (
        <Alert variant="error" title="Não foi possível salvar o endereço">
          {serverError}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Quem recebe"
          autoComplete="name"
          placeholder="Nome completo"
          value={values.recipient}
          error={fieldErrors.recipient}
          onChange={setField('recipient')}
        />
        <Input
          label="Identificação (opcional)"
          placeholder="Casa, trabalho…"
          value={values.label}
          error={fieldErrors.label}
          onChange={setField('label')}
        />
        <Input
          label="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={values.zipCode}
          error={fieldErrors.zipCode}
          onChange={(event) => setField('zipCode')({ target: { value: formatZipCode(event.target.value) } })}
        />
        <Input
          label="Número"
          inputMode="numeric"
          placeholder="123"
          value={values.number}
          error={fieldErrors.number}
          onChange={setField('number')}
        />
        <Input
          label="Rua"
          autoComplete="address-line1"
          placeholder="Nome da rua"
          className="sm:col-span-2"
          value={values.street}
          error={fieldErrors.street}
          onChange={setField('street')}
        />
        <Input
          label="Complemento (opcional)"
          placeholder="Apto, bloco…"
          className="sm:col-span-2"
          value={values.complement}
          error={fieldErrors.complement}
          onChange={setField('complement')}
        />
        <Input
          label="Bairro"
          placeholder="Bairro"
          value={values.district}
          error={fieldErrors.district}
          onChange={setField('district')}
        />
        <Input
          label="Cidade"
          autoComplete="address-level2"
          placeholder="Cidade"
          value={values.city}
          error={fieldErrors.city}
          onChange={setField('city')}
        />
        <Select label="Estado" value={values.state} error={fieldErrors.state} onChange={setField('state')}>
          <option value="">Selecione…</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={submitting}>
          Salvar endereço
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function ShippingPrice({ price }: { price: number }) {
  if (price === 0) {
    return <span className="font-medium text-success">Grátis</span>
  }
  return <span className="font-medium text-foreground">{formatBRL(price)}</span>
}

export function Checkout() {
  return (
    <AuthGate
      title="Entre para finalizar a compra"
      description="Você precisa de uma conta para informar o endereço de entrega e concluir o pedido."
    >
      <CheckoutContent />
    </AuthGate>
  )
}

function CheckoutContent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: cartApi.get })

  const addressesQuery = useQuery({ queryKey: ADDRESSES_QUERY_KEY, queryFn: addressApi.list })
  const addresses = addressesQuery.data

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formValues, setFormValues] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [optionId, setOptionId] = useState<ShippingOption['id']>('standard')
  const [idempotencyLease, setIdempotencyLease] = useState<IdempotencyLease | null>(null)

  useEffect(() => {
    document.title = 'Finalizar compra | Marketplace'
  }, [])

  // Seleção derivada (funciona em SSR e no cliente): a escolha manual vence;
  // sem escolha (ou após remover o selecionado), o padrão da API ou o primeiro.
  const effectiveAddressId =
    selectedAddressId && addresses?.some((address) => address.id === selectedAddressId)
      ? selectedAddressId
      : (addresses?.find((address) => address.isDefault)?.id ?? addresses?.[0]?.id ?? null)
  const selectedAddress = addresses?.find((address) => address.id === effectiveAddressId) ?? null
  const zipCode = selectedAddress?.zipCode ?? null

  const shippingQuery = useQuery({
    queryKey: shippingQueryKey(zipCode ?? ''),
    queryFn: () => shippingApi.options(zipCode!),
    enabled: !!zipCode,
    staleTime: 60_000,
  })
  const quote = shippingQuery.data

  // Nova região volta para a opção Normal (padrão do ML para escolha inicial)
  useEffect(() => {
    setOptionId('standard')
  }, [zipCode])

  const selectedOption = quote?.options.find((option) => option.id === optionId) ?? null

  const createAddressMutation = useMutation({
    mutationFn: (values: AddressFormValues) => addressApi.create(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY })
      setSelectedAddressId(created.id)
      setShowForm(false)
      setFormValues(EMPTY_ADDRESS_FORM)
      setFieldErrors({})
      setServerError(null)
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        setFieldErrors(error.fields)
        setServerError(null)
      } else {
        setFieldErrors({})
        setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível salvar o endereço.')
      }
    },
  })

  const removeAddressMutation = useMutation({
    mutationFn: (id: string) => addressApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY }),
  })

  // Assinatura da tentativa: mudou endereço/entrega/carrinho → nova Idempotency-Key;
  // erro de rede no mesmo cenário reutiliza a key (a API devolve o pedido original)
  const cart = cartQuery.data
  const attemptSignature = useMemo(
    () =>
      [
        selectedAddress?.id ?? '',
        optionId ?? '',
        ...(cart?.items.map((item) => `${item.variantId}:${item.quantity}`) ?? []),
      ].join('|'),
    [selectedAddress?.id, optionId, cart?.items],
  )

  const confirmMutation = useMutation({
    mutationFn: (idempotencyKey: string) =>
      ordersApi.create({ addressId: selectedAddress!.id, deliveryOption: optionId!, idempotencyKey }),
    onSuccess: (order) => {
      // carrinho virou pedido: contador do Header zera e a lista de pedidos recarrega
      queryClient.setQueryData(CART_QUERY_KEY, { items: [], subtotal: 0, totalItems: 0 })
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      navigate(`/checkout/pedido-recebido/${order.code}`)
    },
  })

  function submitAddressForm() {
    setServerError(null)
    const errors = validateAddressForm(formValues)
    setFieldErrors(errors ?? {})
    if (errors) return
    createAddressMutation.mutate(formValues)
  }

  function confirmOrder() {
    if (!selectedAddress || !selectedOption) return
    const lease = resolveIdempotencyKey(idempotencyLease, attemptSignature, newIdempotencyKey)
    setIdempotencyLease(lease)
    confirmMutation.mutate(lease.key)
  }

  const confirmError = confirmMutation.error ? describeOrderError(confirmMutation.error) : null

  if (cartQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col gap-6 py-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </Container>
      </main>
    )
  }

  if (cartQuery.isError) {
    return (
      <main>
        <Container className="py-10">
          <ErrorState
            title="Não conseguimos carregar seu carrinho."
            description="Verifique sua conexão e tente novamente."
            action={
              <Button size="sm" onClick={() => cartQuery.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main>
        <Container className="py-10">
          <EmptyState
            title="Seu carrinho está vazio"
            description="Adicione produtos para finalizar uma compra."
            action={
              <Button size="sm" onClick={() => navigate('/search')}>
                Explorar produtos
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  const total = cart.subtotal + (selectedOption?.price ?? 0)

  return (
    <main>
      <Container className="flex flex-col gap-6 py-6 md:py-8">
        <h1 className="text-h2 text-foreground">Finalizar compra</h1>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* ETAPA 1 — ENDEREÇO */}
            <Card className="flex flex-col gap-4 p-5">
              <StepHeader step={1} title="Endereço de entrega" done={!!selectedAddress} />

              {addressesQuery.isPending && (
                <div className="flex flex-col gap-2" aria-hidden>
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              )}

              {addressesQuery.isError && (
                <ErrorState
                  title="Não conseguimos carregar seus endereços."
                  action={
                    <Button size="sm" onClick={() => addressesQuery.refetch()}>
                      Tentar novamente
                    </Button>
                  }
                />
              )}

              {addresses && addresses.length > 0 && (
                <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Endereço de entrega">
                  {addresses.map((address) => {
                    const selected = address.id === effectiveAddressId
                    const removing = removeAddressMutation.isPending && removeAddressMutation.variables === address.id
                    return (
                      <li
                        key={address.id}
                        className={cn(
                          'flex items-stretch rounded-lg border transition-colors',
                          selected ? 'border-primary bg-info-soft/40' : 'border-line bg-surface',
                        )}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={removing}
                          onClick={() => setSelectedAddressId(address.id)}
                          className={cn(
                            'min-w-0 flex-1 rounded-l-lg p-4 text-left transition-colors disabled:opacity-60',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                            !selected && 'hover:bg-page/60',
                          )}
                        >
                          <p className="flex items-center gap-2 text-body-small font-medium text-foreground">
                            {address.recipient}
                            {address.isDefault && (
                              <span className="rounded bg-success-soft px-1.5 py-0.5 text-caption font-medium text-success-soft-foreground">
                                Padrão
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-body-small text-muted-foreground">
                            {formatAddressStreetLine(address)}
                          </p>
                          <p className="text-body-small text-muted-foreground">{formatAddressCityLine(address)}</p>
                        </button>
                        {removing ? (
                          <span className="flex items-center px-3 text-caption text-muted-foreground" aria-live="polite">
                            Removendo…
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Remover endereço de ${address.recipient}`}
                            onClick={() => removeAddressMutation.mutate(address.id)}
                            className="flex shrink-0 items-center rounded-r-lg px-3 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {addresses && addresses.length === 0 && !showForm && (
                <p className="text-body-small text-muted-foreground">
                  Cadastre um endereço para calcular a entrega.
                </p>
              )}

              {showForm ? (
                <AddressForm
                  values={formValues}
                  fieldErrors={fieldErrors}
                  serverError={serverError}
                  submitting={createAddressMutation.isPending}
                  onValues={(values) => setFormValues(values)}
                  onSubmit={submitAddressForm}
                  onCancel={() => {
                    setShowForm(false)
                    setFormValues(EMPTY_ADDRESS_FORM)
                    setFieldErrors({})
                    setServerError(null)
                  }}
                />
              ) : (
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => setShowForm(true)}
                  disabled={removeAddressMutation.isPending}
                >
                  <PlusIcon className="h-4 w-4" />
                  Adicionar novo endereço
                </Button>
              )}
            </Card>

            {/* ETAPA 2 — ENTREGA */}
            <Card className="flex flex-col gap-4 p-5">
              <StepHeader step={2} title="Entrega" done={!!selectedOption} />
              {!zipCode ? (
                <p className="text-body-small text-muted-foreground">
                  Escolha um endereço para ver as opções de entrega.
                </p>
              ) : shippingQuery.isPending ? (
                <div className="flex flex-col gap-2" aria-hidden>
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : shippingQuery.isError ? (
                <ErrorState
                  title="Não conseguimos calcular a entrega."
                  action={
                    <Button size="sm" onClick={() => shippingQuery.refetch()}>
                      Tentar novamente
                    </Button>
                  }
                />
              ) : quote ? (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Opção de entrega">
                  <p className="text-caption text-muted-foreground">Envio para {quote.region}</p>
                  {quote.options.map((option) => (
                    <Radio
                      key={option.id}
                      name="shipping-option"
                      checked={optionId === option.id}
                      onChange={() => setOptionId(option.id)}
                      labelClassName="flex flex-1 flex-wrap items-center justify-between gap-2"
                      label={
                        <>
                          <span className="flex flex-col">
                            <span className="font-medium text-foreground">{option.label}</span>
                            <span className="text-caption text-muted-foreground">{option.description}</span>
                          </span>
                          <ShippingPrice price={option.price} />
                        </>
                      }
                    />
                  ))}
                </div>
              ) : null}
            </Card>

            {/* ETAPA 3 — REVISÃO E CONFIRMAÇÃO */}
            <Card className="flex flex-col gap-4 p-5">
              <StepHeader step={3} title="Revisão" />

              {confirmError?.kind === 'stock' && (
                <Alert variant="error" title="Estoque insuficiente">
                  {confirmError.message}{' '}
                  <Link to="/cart" className="font-medium underline underline-offset-2">
                    Revisar carrinho
                  </Link>
                </Alert>
              )}
              {confirmError?.kind === 'cart-empty' && (
                <Alert variant="warning" title="Carrinho vazio">
                  {confirmError.message}{' '}
                  <Link to="/cart" className="font-medium underline underline-offset-2">
                    Ir para o carrinho
                  </Link>
                </Alert>
              )}
              {confirmError?.kind === 'generic' && (
                <Alert variant="error" title="Não foi possível confirmar o pedido">
                  {confirmError.message} Ajuste o que for necessário e confirme de novo.
                </Alert>
              )}

              <ul className="flex flex-col divide-y divide-line">
                {cart.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <ProductImage
                      src={item.product.thumbnail}
                      alt={item.product.title}
                      className="h-14 w-14 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-body-small font-medium text-foreground">{item.product.title}</p>
                      <p className="text-caption text-muted-foreground">
                        {Object.entries(item.product.variantAttributes)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(' · ') || 'Produto padrão'}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'} · {formatBRL(item.unitPrice)} un.
                      </p>
                    </div>
                    <p className="text-body-small font-medium text-foreground">{formatBRL(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>

              <Separator />

              <dl className="flex flex-col gap-1.5 text-body-small">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Endereço</dt>
                  <dd className="min-w-0 text-foreground">
                    {selectedAddress
                      ? `${formatAddressStreetLine(selectedAddress)} — ${formatAddressCityLine(selectedAddress)}`
                      : 'Escolha um endereço na etapa 1.'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Entrega</dt>
                  <dd className="min-w-0 text-foreground">
                    {selectedOption
                      ? `${selectedOption.label} — ${selectedOption.description} (${formatBRL(selectedOption.price)})`
                      : 'Escolha a entrega na etapa 2.'}
                  </dd>
                </div>
              </dl>

              <Separator />

              <div className="flex flex-col gap-1.5 text-body-small text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatBRL(cart.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frete</span>
                  {selectedOption ? <ShippingPrice price={selectedOption.price} /> : <span>—</span>}
                </div>
                <div className="flex items-center justify-between text-h4 text-foreground">
                  <span>Total</span>
                  <span>{formatBRL(total)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                loading={confirmMutation.isPending}
                disabled={!selectedAddress || !selectedOption}
                onClick={confirmOrder}
              >
                {confirmMutation.isPending ? 'Confirmando…' : 'Confirmar pedido'}
              </Button>
              <p className="text-center text-caption text-muted-foreground">
                Você não será cobrado agora — o pagamento será habilitado na próxima etapa.
              </p>
            </Card>
          </div>

          {/* RESUMO */}
          <Card className="flex w-full flex-col gap-3 p-5 lg:sticky lg:top-20">
            <h2 className="text-h4 text-foreground">Resumo do pedido</h2>
            <ul className="flex flex-col gap-3">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <ProductImage
                    src={item.product.thumbnail}
                    alt={item.product.title}
                    className="h-12 w-12 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-caption text-foreground">{item.product.title}</p>
                    <p className="text-caption text-muted-foreground">
                      {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
                    </p>
                  </div>
                  <p className="text-body-small font-medium text-foreground">{formatBRL(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex items-center justify-between text-body-small text-muted-foreground">
              <span>Produtos ({cart.totalItems})</span>
              <span>{formatBRL(cart.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-body-small text-muted-foreground">
              <span>Frete</span>
              {selectedOption ? <ShippingPrice price={selectedOption.price} /> : <span>—</span>}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-h4 text-foreground">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>
            {!selectedOption && (
              <p className="text-caption text-muted-foreground">
                O total é finalizado após escolher a opção de entrega.
              </p>
            )}
          </Card>
        </div>
      </Container>
    </main>
  )
}
