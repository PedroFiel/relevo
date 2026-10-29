/** Auxiliares dos testes de página: QueryClient sem novas tentativas + rotas + fetch falso. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

export function comProvedores(ui: ReactNode, rota = '/') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[rota]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

type Resposta = { status?: number; corpo?: unknown }
/** `fetch` falso: cada chamada recebe a resposta da primeira regra cujo trecho aparece em "MÉTODO url". */
export function fetchFalso(regras: Record<string, Resposta | ((init?: RequestInit) => Resposta)>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? 'GET'} ${url}`
    const regra = Object.entries(regras).find(([trecho]) => chave.includes(trecho))?.[1]
    const r = typeof regra === 'function' ? regra(init) : (regra ?? { status: 404, corpo: { detail: 'sem regra' } })
    const status = r.status ?? 200
    return new Response(status === 204 ? null : JSON.stringify(r.corpo ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
