import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Versao } from '../lib/api'
import { INTERVALO_APRESENTACAO_MS } from '../lib/raioX'
import RaioX from './RaioX'

// WebGL não roda no jsdom: a cena 3D vira um dublê que mostra a etapa recebida
vi.mock('./CenaRaioX', () => ({ default: ({ passo }: { passo: string }) => <div data-testid="cena">{passo}</div> }))

const a = (tipo: string, nome: string) => ({ id: nome, tipo, nome, tamanho_bytes: 1, url: `/arquivos/${nome}/download` })
const VERSAO = {
  numero: 1,
  criado_em: '',
  metricas: { faces: 20000, dims_voxels: [64, 30, 20], tamanho_voxel_cm: 0.45, decimacao: { usada: true, faces_antes: 30000, erro_medio_mm: 0.02 } },
  arquivos: [a('glb', 'modelo.glb'), a('mascara', 'mascara-lateral.png'), a('etapa', 'voxels.glb'), a('etapa', 'malha-bruta.glb')],
} as unknown as Versao

function abrir() {
  render(<RaioX imagens={[{ vista: 'lateral', largura_px: 10, altura_px: 10, url: '/imagens/i1' }]} versao={VERSAO} />)
}
const titulo = () => screen.getByRole('heading', { level: 3 }).textContent

describe('Raio-X na página do modelo', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('começa nas fotos e o slider passa pelas etapas', () => {
    abrir()
    expect(titulo()).toContain('1. Fotos')
    expect(screen.getByAltText('Foto Lateral')).toHaveAttribute('src', '/api/imagens/i1')
    fireEvent.change(screen.getByLabelText('Etapa do pipeline'), { target: { value: '2' } })
    expect(titulo()).toContain('3. Voxels')
    expect(screen.getByTestId('cena')).toHaveTextContent('voxels')
    expect(screen.getByRole('button', { name: /3 Voxels/ })).toHaveAttribute('aria-current', 'step')
  })

  it('as setas andam e dão a volta; as silhuetas vêm da API', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Etapa anterior' }))
    expect(titulo()).toContain('6. Final')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }))
    expect(titulo()).toContain('2. Silhuetas')
    expect(screen.getByAltText('Silhueta Lateral')).toHaveAttribute('src', '/api/arquivos/mascara-lateral.png/download')
  })

  it('modo apresentação avança sozinho a cada 4 s e para ao mexer no slider', () => {
    vi.useFakeTimers()
    abrir()
    fireEvent.click(screen.getByRole('button', { name: '▶ Apresentação' }))
    act(() => vi.advanceTimersByTime(INTERVALO_APRESENTACAO_MS * 2))
    expect(titulo()).toContain('3. Voxels')
    fireEvent.change(screen.getByLabelText('Etapa do pipeline'), { target: { value: '0' } })
    act(() => vi.advanceTimersByTime(INTERVALO_APRESENTACAO_MS * 3))
    expect(titulo()).toContain('1. Fotos')
    expect(screen.getByRole('button', { name: '▶ Apresentação' })).toHaveAttribute('aria-pressed', 'false')
  })
})
