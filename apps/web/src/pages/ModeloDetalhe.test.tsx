import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Job, ModeloDetalhe as Detalhe } from '../lib/api'
import { comProvedores, fetchFalso } from '../testes/auxiliares'
import ModeloDetalhe from './ModeloDetalhe'

// WebGL não roda no jsdom: o estúdio 3D vira um dublê que mostra a URL recebida
vi.mock('./Visualizador', () => ({ default: ({ urlFixa }: { urlFixa?: string }) => <div data-testid="estudio">{urlFixa}</div> }))
vi.mock('../components/VisorFoto', () => ({ default: ({ rotulo }: { rotulo: string }) => <div>{rotulo}</div> }))

const ETAPAS = ['segmentacao', 'alinhamento', 'visual_hull', 'marching_cubes', 'decimacao', 'cor', 'exportacao']
const job = (j: Partial<Job>): Job => ({ id: 'j1', modelo_id: 'm1', status: 'processando', etapa_atual: 'alinhamento', progresso: 32, etapas: ETAPAS, erro: null, ...j })
const modelo = (m: Partial<Detalhe>): Detalhe => ({
  id: 'm1',
  nome: 'Tênis azul',
  status: 'processando',
  comprimento_cm: 28,
  imagens: [{ vista: 'lateral', largura_px: 1200, altura_px: 800, url: '/imagens/i1' }],
  versao: null,
  job: job({}),
  criado_em: '2026-10-28T20:00:00Z',
  atualizado_em: '2026-10-28T20:00:00Z',
  ...m,
})
const PRONTO = modelo({
  status: 'pronto',
  job: job({ status: 'concluido', etapa_atual: 'exportacao', progresso: 100 }),
  versao: {
    id: 'v1',
    numero: 1,
    criado_em: '2026-10-28T20:00:05Z',
    arquivos: [{ id: 'a1', tipo: 'glb', nome: 'modelo.glb', tamanho_bytes: 521188, url: '/arquivos/a1/download' }],
    metricas: {
      vistas: ['lateral'], dimensoes_cm: [28, 10.5, 9.8], faces: 20000, fechada: true, avisos: ['Giramos a foto de topo em 90°.'],
      consistencia: {}, orientacao: {}, ajustes: {}, contornos: { lateral: { pontos: [[0, 0], [10, 0], [10, 10]], perimetro_px: 34, area_px: 50 } },
      tempos_s: { segmentacao: 0.5, cor: 0.7 },
    },
  },
  versoes: [
    { id: 'v1', numero: 1, transformacao: null, criado_em: '2026-10-28T20:00:05Z' },
    { id: 'v2', numero: 2, transformacao: [1, 0, 0, 2, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], criado_em: '2026-10-28T20:05:00Z' },
  ],
})

function abrir() {
  comProvedores(
    <Routes>
      <Route path="/modelos/:id" element={<ModeloDetalhe />} />
      <Route path="/modelos" element={<p>lista de modelos</p>} />
    </Routes>,
    '/modelos/m1',
  )
}

describe('página do modelo (F3-T09, F3-T10, F3-T14)', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('enquanto processa mostra as etapas e o progresso do job', async () => {
    fetchFalso({ 'GET /api/modelos/m1': { corpo: modelo({}) }, 'GET /api/jobs/j1': { corpo: job({ etapa_atual: 'visual_hull', progresso: 36 }) } })
    abrir()
    expect(await screen.findByRole('heading', { name: 'Gerando o seu modelo 3D' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '36'))
    const etapas = screen.getAllByRole('listitem')
    expect(etapas[0]).toHaveTextContent('concluída')
    expect(etapas[2]).toHaveTextContent('Esculpir o volume — em andamento')
    expect(etapas[3]).toHaveTextContent('pendente')
    expect(screen.queryByText(/Baixar .glb/)).toBeNull()
  })

  it('pronto: baixar .glb/.obj/.stl, estúdio 3D com a URL da API e aba de fotos com avisos e pincel', async () => {
    const f = fetchFalso({
      'GET /api/modelos/m1': { corpo: PRONTO },
      'POST /api/modelos/m1/versoes/2/restaurar': { corpo: { ...PRONTO, versao: { ...PRONTO.versao!, numero: 2 } } },
      'POST /api/modelos/m1/regerar': { status: 202, corpo: { modelo_id: 'm1', job_id: 'j2' } },
    })
    abrir()
    const baixar = await screen.findByRole('link', { name: /Baixar .glb \(509 KB\)/ })
    expect(baixar).toHaveAttribute('href', '/api/arquivos/a1/download')
    expect(screen.getByRole('link', { name: 'Baixar .obj' })).toHaveAttribute('href', '/api/versoes/v1/exportar?formato=obj')
    expect(screen.getByRole('link', { name: 'Baixar .stl' })).toHaveAttribute('href', '/api/versoes/v1/exportar?formato=stl')
    expect(screen.getByTestId('estudio')).toHaveTextContent('/api/arquivos/a1/download')
    expect(screen.getByText('20.000 faces')).toBeInTheDocument()
    expect(screen.getByText('malha fechada')).toBeInTheDocument()

    // Alternar versão pelo histórico (F4-T04)
    fireEvent.click(screen.getByRole('button', { name: /v2/ }))
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).includes('/versoes/2/restaurar'))).toBe(true))

    // Aba de fotos + corrigir máscara com pincel (F5-T05)
    fireEvent.click(screen.getByRole('button', { name: /Fotos e contornos/ }))
    expect(screen.getByText('Giramos a foto de topo em 90°.')).toBeInTheDocument()
    expect(screen.getByText(/contorno com 3 vértices/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Corrigir com pincel/ }))
    expect(screen.getByRole('heading', { name: /Corrigir silhueta/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Regerar modelo com esta máscara/ }))
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).includes('/regerar'))).toBe(true))
  })

  it('erro: mostra a mensagem do back e o caminho para tentar de novo', async () => {
    const falhou = modelo({ status: 'erro', job: job({ status: 'erro', etapa_atual: 'segmentacao', erro: 'Não encontramos o tênis na foto de cima.' }) })
    fetchFalso({ 'GET /api/modelos/m1': { corpo: falhou } })
    abrir()
    expect(await screen.findByText('Não encontramos o tênis na foto de cima.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar com outras fotos' })).toHaveAttribute('href', '/novo')
  })

  it('apagar pede confirmação e volta para a lista', async () => {
    const f = fetchFalso({ 'GET /api/modelos/m1': { corpo: PRONTO }, 'DELETE /api/modelos/m1': { status: 204 }, 'GET /api/modelos': { corpo: [] } })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }))
    expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }))
    expect(await screen.findByText('lista de modelos')).toBeInTheDocument()
    expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true)
  })

  it('modelo inexistente', async () => {
    fetchFalso({ 'GET /api/modelos/m1': { status: 404, corpo: { detail: 'Modelo não encontrado.' } } })
    abrir()
    const titulo = await screen.findByRole('heading', { level: 1 })
    expect(titulo).toHaveTextContent('Modelo não encontrado')
    expect(within(titulo.parentElement!).getByRole('link', { name: 'Ver meus modelos' })).toBeInTheDocument()
  })
})
