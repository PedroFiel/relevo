import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { MODOS } from './lib/modosRender'
import { comProvedores, fetchFalso } from './testes/auxiliares'

// O canvas WebGL não roda no jsdom: o visualizador usa um dublê
vi.mock('./components/ModelViewer', () => ({ default: () => <div data-testid="viewer" /> }))

function abrir(rota: string) {
  comProvedores(<App />, rota)
}

describe('App', () => {
  beforeEach(() => {
    fetchFalso({
      'GET /api/modelos/': { status: 404, corpo: { detail: 'Modelo não encontrado.' } },
      'GET /api/modelos': { corpo: [] },
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it.each([
    ['/', /modelo 3D/],
    ['/novo', 'Novo modelo'],
    ['/modelos', 'Meus modelos'],
    ['/modelos/abc-123', 'Modelo não encontrado'],
    ['/guia', 'Guia de fotos'],
    ['/rota-que-nao-existe', 'Página não encontrada'],
  ])('renderiza %s com o cabeçalho', async (rota, titulo) => {
    abrir(rota)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/novo', '/modelos'])
  })

  it('renderiza o estúdio (/visualizador) dentro do layout', () => {
    abrir('/visualizador')
    expect(screen.getByTestId('viewer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /RELEVO — início/ })).toHaveAttribute('href', '/')
  })

  it('marca o link da página atual na navegação', () => {
    abrir('/modelos')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Meus modelos' })).toHaveClass('active')
    expect(within(nav).getByRole('link', { name: 'Início' })).not.toHaveClass('active')
  })

  it('tem os 3 modos de visualização da Fase 0', () => {
    expect(MODOS.map((m) => m.id)).toEqual(['solido', 'wireframe', 'normais'])
  })
})
