import { describe, expect, it } from 'vitest'
import { TAMANHO_MAXIMO, estadoDasEtapas, pendencias, validarFoto } from './upload'

const arquivo = (nome: string, type: string, size: number) => ({ name: nome, type, size })

describe('upload (F3-T08)', () => {
  it('aceita JPEG/PNG até 10 MB', () => {
    expect(validarFoto(arquivo('a.jpg', 'image/jpeg', 1000))).toBeNull()
    expect(validarFoto(arquivo('a.png', 'image/png', TAMANHO_MAXIMO))).toBeNull()
    expect(validarFoto(arquivo('foto.JPG', '', 1000))).toBeNull() // alguns celulares não mandam o tipo
  })

  it('recusa outro formato e arquivo grande com mensagem que diz o que fazer', () => {
    expect(validarFoto(arquivo('a.heic', 'image/heic', 1000))).toMatch(/não é JPEG nem PNG/)
    expect(validarFoto(arquivo('a.jpg', 'image/jpeg', 11 * 1024 * 1024))).toMatch(/11,0 MB.*limite é 10 MB/)
  })

  it('lista o que falta para gerar', () => {
    const f = new File([], 'x.jpg')
    expect(pendencias({ nome: '', comprimento_cm: '', fotos: {} })).toEqual([
      'a foto lateral',
      'a foto de cima',
      'um nome',
      'o comprimento (5 a 60 cm)',
    ])
    expect(pendencias({ nome: 'A', comprimento_cm: 80, fotos: { lateral: f, topo: f } })).toEqual(['o comprimento (5 a 60 cm)'])
    expect(pendencias({ nome: 'A', comprimento_cm: 28, fotos: { lateral: f, topo: f } })).toEqual([])
  })
})

describe('etapas do processamento (F3-T09)', () => {
  const etapas = ['segmentacao', 'alinhamento', 'visual_hull', 'exportacao']
  const estados = (atual: string | null, status: Parameters<typeof estadoDasEtapas>[2]) =>
    estadoDasEtapas(etapas, atual, status).map((e) => e.estado)

  it('antes da atual = feita, a atual = atual, depois = pendente', () => {
    expect(estados('alinhamento', 'processando')).toEqual(['feita', 'atual', 'pendente', 'pendente'])
    expect(estados(null, 'pendente')).toEqual(['pendente', 'pendente', 'pendente', 'pendente'])
  })

  it('concluído marca tudo; erro marca a etapa que falhou', () => {
    expect(estados('exportacao', 'concluido')).toEqual(['feita', 'feita', 'feita', 'feita'])
    expect(estados('visual_hull', 'erro')).toEqual(['feita', 'feita', 'falhou', 'pendente'])
  })

  it('tem rótulo em português para cada etapa', () => {
    expect(estadoDasEtapas(etapas, null, 'pendente').map((e) => e.rotulo)).toEqual([
      'Separar o tênis do fundo',
      'Alinhar as fotos',
      'Esculpir o volume',
      'Salvar o arquivo 3D',
    ])
  })
})
