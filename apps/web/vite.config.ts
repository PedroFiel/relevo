/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta padrão 5173; PORT no ambiente permite rodar uma segunda cópia (ex.: preview do editor)
    port: Number(process.env.PORT) || 5173,
    // Em dev, chamadas para /api vão para o FastAPI (porta 8000; o E2E usa outra via API_URL)
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8000',
        rewrite: (p) => p.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  detail:
                    'Servidor offline. A API do RELEVO não está rodando na porta 8000. Use `make dev` para rodar a API e o front juntos, ou `make api` em outro terminal.',
                }),
              )
            }
          })
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'], // e2e/*.spec.ts é do Playwright
  },
})
