/**
 * Playwright (F3-T12 e F2-T09): sobe uma API e um front SÓ para o teste, sem encostar nos de dev.
 *   API   → http://localhost:8001, banco `relevo_test` (o mesmo dos testes do pytest), Storage em out/e2e/storage
 *   front → http://localhost:5180, com o proxy /api apontando para a 8001
 * (E2E_PORTA_API / E2E_PORTA_WEB trocam as portas.)
 * Rodar: `make e2e` (ou `npm run e2e` em apps/web). Precisa do banco de teste criado — `make test-py` cria.
 */
import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { urlBancoTeste } from './e2e/ambiente.ts'

// Portas só do teste (longe das de dev: 5173/5174 do Vite, 8000 da API). Dá para trocar por variável.
const PORTA_API = Number(process.env.E2E_PORTA_API) || 8001
const PORTA_WEB = Number(process.env.E2E_PORTA_WEB) || 5180
const API = `http://localhost:${PORTA_API}`
const WEB = `http://localhost:${PORTA_WEB}`

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../out/e2e/resultados',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: '../../out/e2e/relatorio', open: 'never' }]],
  globalSetup: './e2e/preparar.ts',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 860 },
    locale: 'pt-BR',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 860 },
        // WebGL sem GPU (CI e máquinas sem placa): renderização por software
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  webServer: [
    {
      command: `uv run uvicorn relevo_api.main:app --port ${PORTA_API}`,
      cwd: '../api',
      url: `${API}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DATABASE_URL: urlBancoTeste(), STORAGE_DIR: resolve(import.meta.dirname, '../../out/e2e/storage') },
    },
    {
      command: `npm run dev -- --port ${PORTA_WEB} --strictPort`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_URL: API },
    },
  ],
})
