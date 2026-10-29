/**
 * URL do banco de teste para a API do E2E: TEST_DATABASE_URL (o CI define) ou o DATABASE_URL do
 * .env da raiz trocando a base por `relevo_test` — a mesma regra do `apps/api/tests/conftest.py`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '../../..')

function lerEnv(): Record<string, string> {
  try {
    const texto = readFileSync(resolve(RAIZ, '.env'), 'utf-8')
    return Object.fromEntries(
      texto
        .split('\n')
        .map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
    )
  } catch {
    return {}
  }
}

export function urlBancoTeste(): string {
  const env = { ...lerEnv(), ...process.env }
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL
  const base = env.DATABASE_URL ?? 'postgresql+psycopg://relevo:relevo@localhost:5432/relevo'
  const url = new URL(base.replace(/^postgresql\+psycopg:/, 'http:'))
  url.pathname = '/relevo_test'
  return url.toString().replace(/^http:/, 'postgresql+psycopg:')
}

export const PASTA_FOTOS = resolve(RAIZ, 'samples/reais/tenis-01')
