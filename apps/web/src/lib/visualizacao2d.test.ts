import { describe, expect, it } from 'vitest'
import {
  ABAIXO,
  ACIMA,
  DENTRO,
  DIREITA,
  ESQUERDA,
  aplicar,
  codigoRegiao,
  enquadrar,
  inversa,
  limitarAImagem,
  matrizJanelaViewport,
  matrizRotacaoHoraria,
  multiplicar,
  normalizarRetangulo,
  pan,
  recortarPoligono,
  recortarSegmento,
  tamanhoGirado,
  telaParaMundo,
  zoomEmTorno,
  type Janela,
  type Ponto,
} from './visualizacao2d'

const J: Janela = { x0: 0, y0: 0, x1: 10, y1: 10 }
const perto = (a: Ponto, b: Ponto) => {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('matrizes 3×3', () => {
  it('inversa desfaz a matriz', () => {
    const m = multiplicar([2, 0, 5, 0, 3, -1, 0, 0, 1], [0, -1, 4, 1, 0, 2, 0, 0, 1])
    perto(aplicar(multiplicar(inversa(m), m), { x: 3, y: 7 }), { x: 3, y: 7 })
  })
})

describe('janela → viewport', () => {
  const janela: Janela = { x0: 100, y0: 50, x1: 300, y1: 150 }
  const viewport = { largura: 400, altura: 200 }

  it('leva os cantos da janela aos cantos do viewport', () => {
    const m = matrizJanelaViewport(janela, viewport)
    perto(aplicar(m, { x: 100, y: 50 }), { x: 0, y: 0 })
    perto(aplicar(m, { x: 300, y: 150 }), { x: 400, y: 200 })
    perto(telaParaMundo(janela, viewport, { x: 200, y: 100 }), { x: 200, y: 100 })
  })

  it('enquadrar mantém a proporção do viewport e mostra a imagem toda', () => {
    const j = enquadrar({ largura: 1600, altura: 800 }, { largura: 400, altura: 400 }, 0)
    expect((j.x1 - j.x0) / (j.y1 - j.y0)).toBeCloseTo(1)
    expect(j.x0).toBeCloseTo(0)
    expect(j.x1).toBeCloseTo(1600)
    expect(j.y0).toBeLessThan(0)
  })

  it('zoom em torno do cursor mantém o ponto fixo na tela', () => {
    const v = { largura: 400, altura: 200 }
    const cursorTela = { x: 37, y: 151 }
    const p = telaParaMundo(janela, v, cursorTela)
    const ampliada = zoomEmTorno(janela, p, 4)
    perto(aplicar(matrizJanelaViewport(ampliada, v), p), cursorTela)
    expect(ampliada.x1 - ampliada.x0).toBeCloseTo((janela.x1 - janela.x0) / 4)
  })

  it('pan desloca a janela', () => {
    expect(pan(J, 2, -3)).toEqual({ x0: 2, y0: -3, x1: 12, y1: 7 })
  })
})

describe('Cohen–Sutherland', () => {
  it('códigos de região', () => {
    expect(codigoRegiao({ x: 5, y: 5 }, J)).toBe(DENTRO)
    expect(codigoRegiao({ x: -1, y: -1 }, J)).toBe(ESQUERDA | ACIMA)
    expect(codigoRegiao({ x: 11, y: 12 }, J)).toBe(DIREITA | ABAIXO)
  })

  it('segmento todo dentro é aceito sem mudança', () => {
    expect(recortarSegmento({ x: 1, y: 1 }, { x: 9, y: 2 }, J)).toEqual([{ x: 1, y: 1 }, { x: 9, y: 2 }])
  })

  it('segmento todo fora do mesmo lado é rejeitado', () => {
    expect(recortarSegmento({ x: -5, y: 1 }, { x: -1, y: 9 }, J)).toBeNull()
  })

  it('segmento que cruza uma borda é cortado nela', () => {
    const r = recortarSegmento({ x: 5, y: 5 }, { x: 15, y: 5 }, J)!
    perto(r[1], { x: 10, y: 5 })
  })

  it('segmento que atravessa a janela é cortado nas duas bordas', () => {
    const r = recortarSegmento({ x: -5, y: 0 }, { x: 15, y: 10 }, J)!
    perto(r[0], { x: 0, y: 2.5 })
    perto(r[1], { x: 10, y: 7.5 })
  })

  it('segmento fora que não é rejeitado trivialmente também some', () => {
    expect(recortarSegmento({ x: -2, y: 8 }, { x: 2, y: 14 }, J)).toBeNull()
  })
})

describe('Sutherland–Hodgman', () => {
  it('polígono todo dentro não muda', () => {
    const q = [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }]
    expect(recortarPoligono(q, J)).toEqual(q)
  })

  it('polígono todo fora vira vazio', () => {
    expect(recortarPoligono([{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 25, y: 30 }], J)).toEqual([])
  })

  it('quadrado maior que a janela vira a própria janela', () => {
    const r = recortarPoligono([{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }], J)
    const xs = r.map((p) => p.x)
    const ys = r.map((p) => p.y)
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 10, 0, 10])
  })

  it('triângulo com uma ponta para fora perde a ponta e ganha 2 vértices na borda', () => {
    const r = recortarPoligono([{ x: 2, y: 2 }, { x: 14, y: 5 }, { x: 2, y: 8 }], J)
    expect(r).toHaveLength(4)
    expect(r.filter((p) => Math.abs(p.x - 10) < 1e-9)).toHaveLength(2)
    expect(r.every((p) => p.x <= 10 + 1e-9)).toBe(true)
  })
})

describe('editor de recorte', () => {
  it('normaliza retângulo arrastado ao contrário', () => {
    expect(normalizarRetangulo({ x: 50, y: 40 }, { x: 10, y: 5 })).toEqual({ x: 10, y: 5, largura: 40, altura: 35 })
  })

  it('limita o recorte à imagem', () => {
    expect(limitarAImagem({ x: -20, y: 10, largura: 100, altura: 500 }, { largura: 300, altura: 200 })).toEqual({
      x: 0,
      y: 10,
      largura: 80,
      altura: 190,
    })
  })

  it('rotação horária leva os cantos aos lugares certos (inversa do pipeline)', () => {
    const img = { largura: 40, altura: 30 }
    perto(aplicar(matrizRotacaoHoraria(90, img), { x: 0, y: 0 }), { x: 30, y: 0 }) // sup. esq. → sup. dir.
    perto(aplicar(matrizRotacaoHoraria(270, img), { x: 0, y: 0 }), { x: 0, y: 40 }) // → inf. esq.
    perto(aplicar(matrizRotacaoHoraria(180, img), { x: 0, y: 0 }), { x: 40, y: 30 })
    expect(tamanhoGirado(90, img)).toEqual({ largura: 30, altura: 40 })
  })
})
