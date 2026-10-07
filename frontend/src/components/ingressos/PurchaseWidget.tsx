import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { IconBadge } from './Controls'

// Widget "Compra em andamento": aparece em rotas de ingressos quando há reserva
// ativa; oculto em /checkout, /payments/* e /checkout/success. Sincroniza entre
// abas via BroadcastChannel (fallback storage event). Ao expirar mostra toast.

const HIDDEN_ROUTES = ['/checkout', '/payments', '/checkout/success']
const CHANNEL_NAME = 'ingressos-reservation'
const REVALIDATE_MS = 30_000
const ANNOUNCE_AT_S = 60

type ActiveReservation = {
  id: string
  quantity: number
  expiresAt: string
  offer: {
    id: string
    ticketType: string
    ticketCategory: string
    priceCents: number
    session: { id: string; startsAt: string; city: string; venue: string }
    event: { slug: string; name: string }
  }
}

export function PurchaseWidget({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hidden = HIDDEN_ROUTES.some((route) => location.pathname.startsWith(route))

  return (
    <>
      {!hidden && <PurchaseReservationWidget />}
      {children}
    </>
  )
}

function PurchaseReservationWidget() {
  const [reservation, setReservation] = useState<ActiveReservation | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showToast, setShowToast] = useState(false)
  const [announced60s, setAnnounced60s] = useState(false)
  const clockSkewRef = useRef(0)

  const fetchReservations = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/reservations/active', { headers: { Accept: 'application/json' } })
      if (!res.ok) { setReservation(null); return }
      const dateHeader = res.headers.get('Date')
      if (dateHeader) clockSkewRef.current = new Date(dateHeader).getTime() - Date.now()
      const body = (await res.json()) as ActiveReservation[]
      if (body.length > 0) {
        setReservation(body[0])
        setAnnounced60s(false)
      } else {
        setReservation(null)
      }
    } catch { setReservation(null) }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => {
    void fetchReservations()
    const interval = setInterval(() => void fetchReservations(), REVALIDATE_MS)
    const onFocus = () => void fetchReservations()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [fetchReservations])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => {
      const type = event.data?.type as string | undefined
      if (type === 'reservation-cancelled' || type === 'reservation-expired') {
        setReservation(null)
        if (type === 'reservation-expired') setShowToast(true)
      }
      if (type === 'reservation-created') void fetchReservations()
    }
    return () => { channel.close() }
  }, [fetchReservations])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CHANNEL_NAME || !event.newValue) return
      try {
        const data = JSON.parse(event.newValue) as { type?: string }
        if (data.type === 'reservation-cancelled' || data.type === 'reservation-expired') {
          setReservation(null)
          if (data.type === 'reservation-expired') setShowToast(true)
        }
      } catch { /* ignora */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!reservation) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [reservation])

  const expiresAtMs = reservation ? new Date(reservation.expiresAt).getTime() + clockSkewRef.current : 0
  const secondsLeft = reservation ? Math.max(0, Math.floor((expiresAtMs - now) / 1000)) : 0

  useEffect(() => {
    if (reservation && secondsLeft <= 0) {
      setReservation(null)
      setShowToast(true)
      try { new BroadcastChannel(CHANNEL_NAME).postMessage({ type: 'reservation-expired' }) } catch { /* ignora */ }
    }
  }, [secondsLeft, reservation])

  useEffect(() => {
    if (secondsLeft === ANNOUNCE_AT_S && !announced60s) setAnnounced60s(true)
  }, [secondsLeft, announced60s])

  if (!loaded || !reservation) return showToast ? <ExpiryToast /> : null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const countdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const price = reservation.offer.priceCents / 100
  const ticket = `${reservation.offer.ticketCategory} · R$ ${price}`

  return (
    <>
      {showToast && <ExpiryToast onDismiss={() => setShowToast(false)} />}
      <div
        role="region"
        aria-label="Compra em andamento"
        className={cn(
          'fixed z-40',
          'md:bottom-6 md:right-6 md:left-auto md:w-80',
          'bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 right-3',
        )}
      >
        <div className="flex flex-col gap-2.5 rounded-t-card bg-surface p-4 shadow-t-dialog">
          <div className="flex items-center gap-2">
            <IconBadge icon="⏱">em andamento</IconBadge>
            <span className="text-t-label-strong text-ticket-text">Compra em andamento</span>
            <time
              className="ml-auto font-sora text-t-label-strong text-ticket-primary"
              aria-live={secondsLeft <= ANNOUNCE_AT_S ? 'polite' : 'off'}
            >
              {countdown}
            </time>
          </div>
          <div className="rounded-t-control bg-ticket-surface2 p-2.5">
            <p className="line-clamp-2 text-t-caption-strong text-ticket-text">{reservation.offer.event.name}</p>
            <p className="text-t-caption text-ticket-muted">{ticket}</p>
          </div>
          <Link
            to={`/checkout?offer=${encodeURIComponent(reservation.offer.id)}`}
            className="flex h-10 w-full items-center justify-center rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
          >
            Voltar ao checkout →
          </Link>
        </div>
      </div>
    </>
  )
}

function ExpiryToast({ onDismiss }: { onDismiss?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-t-pill bg-ticket-warn-soft px-4 py-2 text-t-caption-strong text-ticket-warn shadow-t-dialog">
      Sua reserva expirou
    </div>
  )
}
