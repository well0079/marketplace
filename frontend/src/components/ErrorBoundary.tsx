import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">Ocorreu um erro</h1>
          <p className="text-ink-secondary">Algo saiu errado ao carregar esta página.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-ml-blue px-6 py-3 font-semibold text-white hover:bg-ml-blue-hover"
          >
            Tentar novamente
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
