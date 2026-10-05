// Showcase do tema ingressos — rota de referência visual (não é página de negócio).
// Todos os textos/dados são placeholders nossos; tokens auditados em docs/DESIGN_AUDIT.md.

import { useState } from 'react'
import { BottomNav, LanguageToggle, TopBar } from '../components/ingressos/Layout'
import { Chip, CountdownPill, DeadlineMeter, Field, IconBadge, IconButton, Modal, StatusPill, useModal } from '../components/ingressos/Controls'
import { CategoryTile, EventCarousel, EventRow, OfferRow, OrderCard, OrderSummary, ScrollRail, SectionHeader, StepRail, type TicketEventData } from '../components/ingressos/Cards'

const PLACEHOLDER_EVENTS: TicketEventData[] = [
  { id: 'festival-luz', title: 'Festival da Luz 2026', date: '12 dez', venue: 'Parque das Nações', price: 120, badge: 'últimos ingressos' },
  { id: 'noite-sertao', title: 'Noite do Sertão', date: '18 jan', venue: 'Arena Central', price: 80 },
  { id: 'rock-da-serra', title: 'Rock da Serra', date: '02 fev', venue: 'Anfiteatro Verde', price: 150, badge: 'novo' },
  { id: 'baile-neon', title: 'Baile Neon', date: '21 fev', venue: 'Pavilhão 7', price: 60 },
]

export function DesignIngressosShowcase() {
  const modal = useModal()
  const [lang, setLang] = useState<'PT' | 'EN'>('PT')
  const [nav, setNav] = useState('Descobrir')
  const [chip, setChip] = useState('Hoje')

  return (
    <main className="flex min-h-screen flex-col bg-ticket-surface-muted font-hanken">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-2 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-lexend text-t-display text-ticket-text">Showcase — tema ingressos</h1>
          <p className="max-w-prose text-t-body text-ticket-muted">
            Referência visual auditada (tokens em docs/DESIGN_AUDIT.md). Componentes com dados placeholders.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle value={lang} onChange={setLang} />
            <IconBadge icon="🎫" tone="solid">showcase</IconBadge>
            <StatusPill status="confirmado" />
            <StatusPill status="pendente" />
            <StatusPill status="cancelado" />
            <StatusPill status="expirado" />
          </div>
        </header>

        <section aria-label="Categorias">
          <SectionHeader icon="🗺️" title="Categorias" actionLabel="Ver tudo" />
          <ScrollRail ariaLabel="Categorias">
            {[
              ['⚽', 'Futebol'], ['🎭', 'Teatro'], ['🎸', 'Rock'], ['⭐', 'Pop'], ['🤠', 'Sertanejo'], ['🎪', 'Festival'],
            ].map(([icon, label]) => (
              <li key={label} className="snap-start">
                <CategoryTile icon={icon} label={label} selected={label === 'Rock'} />
              </li>
            ))}
          </ScrollRail>
        </section>

        <section aria-label="Filtros rápidos">
          <SectionHeader icon="⚡" title="Filtros rápidos" />
          <div className="flex flex-wrap gap-2">
            {['Hoje', 'Amanhã', 'Este mês', 'Perto de mim'].map((label) => (
              <Chip key={label} selected={chip === label} onClick={() => setChip(label)}>
                {label}
              </Chip>
            ))}
          </div>
        </section>

        <section aria-label="Eventos em destaque">
          <SectionHeader icon="🎫" title="Eventos em destaque" actionLabel="Ver tudo" />
          <EventCarousel events={PLACEHOLDER_EVENTS} />
        </section>

        <section aria-label="Listagem em linhas">
          <SectionHeader icon="📜" title="Próximos na sua região" />
          <ul className="flex flex-col gap-2">
            {PLACEHOLDER_EVENTS.slice(0, 3).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </section>

        <section aria-label="Ofertas">
          <SectionHeader icon="🔥" title="Ofertas" />
          <div className="grid gap-3 md:grid-cols-2">
            <OfferRow title="Lote 2 — Festival da Luz" price={96} originalPrice={120} deadline="termina em 48h" />
            <OfferRow title="Meia-entrada estudantil" price={40} originalPrice={80} />
          </div>
        </section>

        <section aria-label="Contagem e prazos" className="flex flex-col gap-4">
          <SectionHeader icon="⏱️" title="Contagem e prazos" />
          <CountdownPill label="vendas encerram em" value="02:14:09" />
          <div className="max-w-sm">
            <DeadlineMeter label="Lote 1 — 80% vendido" percent={80} deadline="encerra 30/11" />
          </div>
        </section>

        <section aria-label="Passos e resumo" className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionHeader icon="🧭" title="Fluxo de compra" />
            <StepRail steps={['Ingressos', 'Pagamento', 'Confirmação']} current={1} />
            <IconButton icon="🛒" label="Abrir carrinho" />
            <button type="button" onClick={modal.show} className="h-11 w-fit rounded-t-control bg-ticket-primary px-5 text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline">
              Abrir modal
            </button>
          </div>
          <OrderSummary
            rows={[
              { label: 'Ingresso inteira × 2', value: 'R$ 240' },
              { label: 'Taxa de serviço', value: 'R$ 14' },
            ]}
            total="R$ 254"
          />
        </section>

        <section aria-label="Formulário e pedidos" className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <SectionHeader icon="🪪" title="Campos" />
            <Field label="Nome no ingresso" placeholder="Como será impresso" />
            <Field label="CPF" placeholder="000.000.000-00" hint="Usado na validação de entrada" inputMode="numeric" />
            <Field label="E-mail" placeholder="voce@exemplo.com" error="Informe um e-mail válido." inputMode="email" />
          </div>
          <div className="flex flex-col gap-3">
            <SectionHeader icon="🧾" title="Pedidos" />
            <OrderCard code="TK-2026-0012" eventTitle="Festival da Luz 2026" date="12 dez · Parque das Nações" total="R$ 254" status="confirmado" />
            <OrderCard code="TK-2026-0031" eventTitle="Baile Neon" date="21 fev · Pavilhão 7" total="R$ 60" status="pendente" />
          </div>
        </section>
      </div>

      <div className="mt-auto">
        <BottomNav
          items={[{ label: 'Descobrir', icon: '🏠' }, { label: 'Pesquisar', icon: '🔍' }, { label: 'Ingressos', icon: '🎫' }, { label: 'Conversas', icon: '💬' }, { label: 'Entrar', icon: '👤' }]}
          active={nav}
          onNavigate={setNav}
        />
      </div>

      {modal.open && (
        <Modal title="Selecionar ingressos" onClose={modal.hide}>
          <div className="flex flex-col gap-3">
            <p className="text-t-body text-ticket-muted">Conteúdo de demonstração do modal (sheet radius t-sheet, scrim auditado).</p>
            <div className="flex flex-wrap gap-2">
              <CountdownPill label="lote encerra em" value="01:59:59" />
            </div>
            <button type="button" onClick={modal.hide} className="h-11 rounded-t-control bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press">
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
