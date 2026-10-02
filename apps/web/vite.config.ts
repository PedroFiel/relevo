/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta padrão 5173; PORT no ambiente permite rodar uma segunda cópia (ex.: preview do editor)
    port: Number(process.env.PORT) || 5173,
    // Em dev, chamadas para /api vão para o FastAPI (porta 8000)
    proxy: { '/api': { target: 'http://localhost:8000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
