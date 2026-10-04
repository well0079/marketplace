import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[1200px] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-ink-secondary">Página não encontrada.</p>
      <Link to="/" className="rounded bg-ml-blue px-6 py-3 font-semibold text-white hover:bg-ml-blue-hover">
        Voltar ao início
      </Link>
    </main>
  )
}
