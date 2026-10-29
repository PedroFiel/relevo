import { describe, expect, it } from 'vitest'
import type { Arquivo, Imagem, MetricasVersao } from './api'
import { arquivosDoRaioX, passosDoRaioX } from './raioX'

const arq = (tipo: string, nome: string): Arquivo => ({ id: nome, tipo, nome, tamanho_bytes: 1, url: `/arquivos/${nome}/download` })
const img = (vista: Imagem['vista']): Imagem => ({ vista, largura_px: 10, altura_px: 10, url: `/imagens/${vista}` })
const COMPLETO = [
  arq('glb', 'modelo.glb'),
  arq('mascara', 'mascara-topo.png'),
  arq('mascara', 'mascara-lateral.png'),
  arq('etapa', 'voxels.glb'),
  arq('etapa', 'malha-bruta.glb'),
]
const metricas = {
  faces: 20000,
  dims_voxels: [128, 60, 45],
  decimacao: { usada: true, faces_antes: 61084, erro_medio_mm: 0.026 },
} as unknown as MetricasVersao

describe('Raio-X (F5-T01)', () => {
  it('separa os arquivos pelo papel e põe as máscaras na ordem das vistas', () => {
    const a = arquivosDoRaioX(COMPLETO)
    expect(a.glb?.nome).toBe('modelo.glb')
    expect(a.voxels?.nome).toBe('voxels.glb')
    expect(a.bruta?.nome).toBe('malha-bruta.glb')
    expect(a.mascaras.map((m) => m.vista)).toEqual(['lateral', 'topo'])
  })

  it('tem as 6 etapas na ordem do pipeline, com os números do modelo na legenda', () => {
    const passos = passosDoRaioX([img('lateral'), img('topo')], arquivosDoRaioX(COMPLETO), metricas)
    expect(passos.map((p) => p.id)).toEqual(['fotos', 'mascaras', 'voxels', 'bruta', 'decimada', 'final'])
    expect(passos.map((p) => p.tipo)).toEqual(['2d', '2d', '3d', '3d', '3d', '3d'])
    expect(passos[2].legenda).toContain('128 × 60 × 45')
    expect(passos[3].legenda).toContain('61.084 faces')
    expect(passos[4].legenda).toMatch(/61\.084 → 20\.000 faces.*0,026 mm/)
  })

  it('modelo sem intermediários (antigo) mostra só fotos e o final', () => {
    const passos = passosDoRaioX([img('lateral')], arquivosDoRaioX([arq('glb', 'modelo.glb')]), { faces: 1 } as MetricasVersao)
    expect(passos.map((p) => p.id)).toEqual(['fotos', 'final'])
  })
})
