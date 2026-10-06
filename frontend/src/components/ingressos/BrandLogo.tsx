import { Link } from 'react-router-dom'

// Marca do tema ingressos: wordmark em TEXTO (um único componente, sem logo image)
export function BrandLogo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <Link to="/" aria-label="Ingressos — página inicial" className={`font-lexend text-t-h2 tracking-tight ${tone === 'light' ? 'text-on-ticket-white' : 'text-ticket-text'}`}>
      <span className="font-semibold">ingre</span>
      <span className="font-bold">ssos</span>
    </Link>
  )
}
