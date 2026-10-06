import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconBadge } from './Controls'

const LEGAL_NOTICE =
  'Este site é um marketplace de revenda de ingressos de terceiros. Os ingressos são oferecidos por vendedores independentes e os preços são definidos por eles — podem ser superiores aos do canal oficial.'

// Faixa fina de aviso legal no topo
export function LegalStrip({ text = LEGAL_NOTICE }: { text?: string }) {
  return (
    <div className="bg-ticket-deep-purple px-4 py-1.5 text-center">
      <p className="mx-auto max-w-[1200px] text-t-nano text-on-ticket-white/90">{text}</p>
    </div>
  )
}

// Alerta amarelo controlado por env (VITE_ALERT_BANNER_TEXT; vazio = oculto)
export function AlertBanner() {
  const text = (import.meta.env.VITE_ALERT_BANNER_TEXT as string | undefined) ?? ''
  if (text.trim() === '') return null
  return (
    <div role="status" className="bg-ticket-caution px-4 py-2 text-center">
      <p className="mx-auto max-w-[1200px] text-t-caption-strong text-ticket-caution-text">{text}</p>
    </div>
  )
}

// Rodapé completo: garantia (3 itens, sem selos de terceiros) + colunas + redes + legal
const SOCIAL_LINKS: { name: string; url: string; icon: string }[] = [
  { name: 'X', url: import.meta.env.VITE_SOCIAL_X_URL as string | undefined ?? '', icon: '𝕏' },
  { name: 'Instagram', url: import.meta.env.VITE_SOCIAL_INSTAGRAM_URL as string | undefined ?? '', icon: '📸' },
  { name: 'TikTok', url: import.meta.env.VITE_SOCIAL_TIKTOK_URL as string | undefined ?? '', icon: '🎵' },
].filter((social) => social.url !== '')

const HELP_FAQ_URL = import.meta.env.VITE_HELP_FAQ_URL as string | undefined ?? ''
const HELP_WHATSAPP_URL = import.meta.env.VITE_HELP_WHATSAPP_URL as string | undefined ?? ''

export function Footer() {
  return (
    <footer className="border-t border-ticket-hairline bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <h2 className="font-lexend text-t-title text-ticket-text">Compra Garantida</h2>
            <ul className="flex flex-col gap-2.5 text-t-body-s text-ticket-muted">
              <li className="flex items-center gap-2">
                <IconBadge icon="🎟️" tone="soft">ingresso autêntico</IconBadge>
              </li>
              <li className="flex items-center gap-2">
                <IconBadge icon="🔒" tone="soft">pagamento protegido</IconBadge>
              </li>
              <li className="flex items-center gap-2">
                <IconBadge icon="💬" tone="soft">suporte até o evento</IconBadge>
              </li>
            </ul>
            <p className="text-t-nano text-ticket-faint">
              Garantia própria do marketplace — sem certificadoras de terceiros.
            </p>
          </div>

          <nav aria-label="Precisa de ajuda?" className="flex flex-col gap-2.5">
            <h2 className="font-lexend text-t-title text-ticket-text">Precisa de ajuda?</h2>
            {HELP_FAQ_URL && (
              <a href={HELP_FAQ_URL} className="text-t-body-s text-ticket-muted transition-colors hover:text-ticket-primary">
                Perguntas frequentes (FAQ)
              </a>
            )}
            {HELP_WHATSAPP_URL && (
              <a href={HELP_WHATSAPP_URL} className="text-t-body-s text-ticket-muted transition-colors hover:text-ticket-primary">
                WhatsApp
              </a>
            )}
            <Link to="/terms" className="text-t-body-s text-ticket-muted transition-colors hover:text-ticket-primary">
              Central de ajuda
            </Link>
          </nav>

          <nav aria-label="Políticas" className="flex flex-col gap-2.5">
            <h2 className="font-lexend text-t-title text-ticket-text">Políticas</h2>
            <Link to="/terms" className="text-t-body-s text-ticket-muted transition-colors hover:text-ticket-primary">
              Termos de uso
            </Link>
            <Link to="/privacy" className="text-t-body-s text-ticket-muted transition-colors hover:text-ticket-primary">
              Privacidade
            </Link>
            {SOCIAL_LINKS.length > 0 && (
              <div className="mt-2 flex items-center gap-3">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    aria-label={social.name}
                    className="flex h-9 w-9 items-center justify-center rounded-t-circle border border-ticket-border text-ticket-muted transition-colors hover:text-ticket-primary"
                  >
                    <span aria-hidden>{social.icon}</span>
                  </a>
                ))}
              </div>
            )}
          </nav>
        </div>

        <div className="mt-8 border-t border-ticket-hairline pt-4">
          <p className="text-t-nano text-ticket-faint">
            Marketplace de revenda de ingressos de terceiros: a plataforma intermedia a venda e os
            preços são definidos pelos vendedores.
          </p>
          <p className="mt-1 text-t-nano text-ticket-faint">
            © 2026 ingressos — projeto demonstrativo. Todo o conteúdo é fictício.
          </p>
        </div>
      </div>
    </footer>
  )
}

// Conteúdo demonstrativo compartilhado por /terms e /privacy
export function DemoLegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <h1 className="font-lexend text-t-display text-ticket-text">{title}</h1>
        <p className="mt-2 text-t-caption text-ticket-faint">
          Conteúdo DEMONSTRATIVO — substituir pelo texto oficial antes de operar.
        </p>
        <div className="mt-6 flex flex-col gap-4 text-t-body text-ticket-muted">{children}</div>
      </div>
    </main>
  )
}
