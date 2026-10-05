import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
// Tema ingressos: Hanken Grotesk (corpo), Lexend (títulos), Sora (numérico)
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/lexend/600.css'
import '@fontsource/lexend/700.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import './styles/globals.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
