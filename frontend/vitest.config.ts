import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// jsdom global: os testes Testing Library (bloco 3b) precisam de DOM; os testes
// SSR existentes (renderToStaticMarkup) seguem funcionando igualmente no jsdom.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom' },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
})
