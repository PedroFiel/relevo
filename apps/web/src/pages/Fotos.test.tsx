import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ListaAvisos from '../components/ListaAvisos'
import { poligonoNaTela, IDENTIDADE } from '../lib/visualizacao2d'
import { ajustesParaJson, type Metricas } from '../lib/vistas'
import Fotos from './Fotos'

describe('contorno na tela', () => {
  it('leva o contorno à tela e recorta o que sai da janela', () => {
    const quadrado: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]]
    // janela mostra só a metade esquerda (x 0..50) num viewport 100×200: escala 2
    const tela = poligonoNaTela(quadrado, IDENTIDADE, { x0: 0, y0: 0, x1: 50, y1: 100 }, { largura: 100, altura: 200 })
    expect(Math.max(...tela.map((p) => p.x))).toBeCloseTo(100)
    expect(Math.max(...tela.map((p) => p.y))).toBeCloseTo(200)
  })
})

describe('ajustes.json', () => {
  it('só leva as vistas que o usuário mexeu, no formato do pipeline', () => {
    const json = ajustesParaJson({
      lateral: { rotacao_graus: 0, recorte: null },
      topo: { rotacao_graus: 270, recorte: [40, 110, 700, 270] },
    })
    expect(JSON.parse(json)).toEqual({ topo: { rotacao_graus: 270, recorte: [40, 110, 700, 270] } })
  })
})

describe('ListaAvisos', () => {
  it('lista vazia diz que está tudo certo', () => {
    render(<ListaAvisos avisos={[]} />)
    expect(screen.getByText('Nenhum problema nas fotos.')).toBeInTheDocument()
  })

  it('mostra cada aviso', () => {
    render(<ListaAvisos avisos={['Giramos a foto de topo.', 'Recorte a foto.']} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('página Fotos', () => {
  afterEach(() => vi.unstubAllGlobals())

  const metricas: Metricas = {
    vistas: ['lateral', 'topo', 'tras'],
    dimensoes_cm: [30, 12.4, 11],
    faces: 197304,
    fechada: true,
    avisos: ['Giramos a foto da sola 180° para deixar o calcanhar à esquerda e o bico à direita.'],
    consistencia: { iou_lateral: 0.99, iou_topo: 0.95, iou_tras: 0.99, razao_tras: 1.07 },
    secao: { usada: true, volume_removido_pct: 7.9 },
    orientacao: {},
    ajustes: {
      lateral: { rotacao_graus: 0, recorte: null, matriz: [] },
      topo: { rotacao_graus: 270, recorte: [40, 110, 700, 270], matriz: [] },
      tras: { rotacao_graus: 0, recorte: null, matriz: [] },
    },
    contornos: {
      lateral: { pontos: [[0, 0], [10, 0], [10, 10]], perimetro_px: 34.1, area_px: 50 },
      topo: { pontos: [[0, 0], [10, 0], [10, 10]], perimetro_px: 34.1, area_px: 50 },
      tras: { pontos: [[0, 0], [10, 0], [10, 10]], perimetro_px: 34.1, area_px: 50 },
    },
  }

  it('mostra avisos, métricas, um cartão por vista e o ajustes.json que gerou o modelo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(metricas))))
    render(
      <MemoryRouter>
        <Fotos />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Giramos a foto da sola/)).toBeInTheDocument()
    expect(screen.getByText(/197.304 faces/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Traseira (calcanhar)' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ajustar' })).toHaveLength(3)
    expect(screen.getByText(/"rotacao_graus": 270/)).toBeInTheDocument()
  })

  it('sem as fotos publicadas, explica o que rodar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    render(
      <MemoryRouter>
        <Fotos />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('make reais')
  })
})
