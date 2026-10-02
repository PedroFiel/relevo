/**
 * Pipeline de visualização 2D (F2-T10) — funções puras, sem React nem canvas.
 *
 *   coordenadas do MUNDO (pixels da foto)  --janela-->  recorte  --matriz janela→viewport-->  TELA
 *
 * - A **janela** é o retângulo do mundo que está visível. Ampliar (zoom) = encolher a janela;
 *   arrastar (pan) = deslocar a janela.
 * - A **transformação janela → viewport** é uma escala + translação, escrita como matriz 3×3 em
 *   coordenadas homogêneas (mesma ideia do pipeline em Python, `ajuste.py`).
 * - **Recorte (clipping)**: antes de desenhar, cortamos linhas (Cohen–Sutherland) e polígonos
 *   (Sutherland–Hodgman) contra a janela — só o que está dentro chega à tela.
 *
 * Convenção: pixels da foto e da tela crescem para a DIREITA (x) e para BAIXO (y).
 */

export type Ponto = { x: number; y: number }
/** Retângulo por cantos: x0 < x1 e y0 < y1. */
export type Janela = { x0: number; y0: number; x1: number; y1: number }
export type Tamanho = { largura: number; altura: number }
/** Matriz 3×3 em ordem de linhas: [a, b, c, d, e, f, 0, 0, 1] ↔ x' = a·x + b·y + c; y' = d·x + e·y + f */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

// ---------- Matrizes 3×3 ----------
export const IDENTIDADE: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function multiplicar(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[3 * i + j] += a[3 * i + k] * b[3 * k + j]
  return r
}

export function aplicar(m: Mat3, p: Ponto): Ponto {
  return { x: m[0] * p.x + m[1] * p.y + m[2], y: m[3] * p.x + m[4] * p.y + m[5] }
}

export function translacao(tx: number, ty: number): Mat3 {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1]
}

export function escala(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
}

/** Inversa de uma matriz afim (última linha 0 0 1). */
export function inversa(m: Mat3): Mat3 {
  const [a, b, c, d, e, f] = m
  const det = a * e - b * d
  return [e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det, 0, 0, 1]
}

// ---------- Janela → viewport ----------
/** Leva a janela (mundo) ao viewport (tela): M = S(L/largura_janela, A/altura_janela) · T(−x0, −y0). */
export function matrizJanelaViewport(j: Janela, v: Tamanho): Mat3 {
  return multiplicar(escala(v.largura / (j.x1 - j.x0), v.altura / (j.y1 - j.y0)), translacao(-j.x0, -j.y0))
}

export function telaParaMundo(j: Janela, v: Tamanho, p: Ponto): Ponto {
  return aplicar(inversa(matrizJanelaViewport(j, v)), p)
}

/** Janela que mostra a imagem inteira, centralizada, com a MESMA proporção do viewport (sem distorcer). */
export function enquadrar(imagem: Tamanho, v: Tamanho, folga = 0.04): Janela {
  const ladoX = imagem.largura * (1 + 2 * folga)
  const ladoY = imagem.altura * (1 + 2 * folga)
  const k = Math.max(ladoX / v.largura, ladoY / v.altura) // mundo por pixel de tela
  const cx = imagem.largura / 2
  const cy = imagem.altura / 2
  return { x0: cx - (k * v.largura) / 2, x1: cx + (k * v.largura) / 2, y0: cy - (k * v.altura) / 2, y1: cy + (k * v.altura) / 2 }
}

/**
 * Zoom em torno de um ponto do mundo (o que está sob o cursor fica parado na tela):
 * cada canto da janela vai para p + (canto − p) / fator — ou seja, T(p) · S(1/fator) · T(−p).
 */
export function zoomEmTorno(j: Janela, p: Ponto, fator: number): Janela {
  const m = multiplicar(translacao(p.x, p.y), multiplicar(escala(1 / fator, 1 / fator), translacao(-p.x, -p.y)))
  const a = aplicar(m, { x: j.x0, y: j.y0 })
  const b = aplicar(m, { x: j.x1, y: j.y1 })
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

/** Fator de ampliação atual em relação a uma janela de referência (1 = enquadrado). */
export function ampliacao(j: Janela, referencia: Janela): number {
  return (referencia.x1 - referencia.x0) / (j.x1 - j.x0)
}

export function pan(j: Janela, dx: number, dy: number): Janela {
  return { x0: j.x0 + dx, x1: j.x1 + dx, y0: j.y0 + dy, y1: j.y1 + dy }
}

/** Janela encolhida em torno do centro (usada no modo didático: recorte visível dentro da tela). */
export function encolher(j: Janela, fracao: number): Janela {
  const mx = ((j.x1 - j.x0) * (1 - fracao)) / 2
  const my = ((j.y1 - j.y0) * (1 - fracao)) / 2
  return { x0: j.x0 + mx, x1: j.x1 - mx, y0: j.y0 + my, y1: j.y1 - my }
}

// ---------- Recorte de segmentos: Cohen–Sutherland ----------
export const DENTRO = 0
export const ESQUERDA = 1
export const DIREITA = 2
export const ACIMA = 4 // y menor (o y da tela cresce para baixo)
export const ABAIXO = 8

/** Código de região de 4 bits: em que lado(s) da janela o ponto está. */
export function codigoRegiao(p: Ponto, j: Janela): number {
  let c = DENTRO
  if (p.x < j.x0) c |= ESQUERDA
  else if (p.x > j.x1) c |= DIREITA
  if (p.y < j.y0) c |= ACIMA
  else if (p.y > j.y1) c |= ABAIXO
  return c
}

/**
 * Cohen–Sutherland: aceita trivialmente (os dois códigos 0), rejeita trivialmente (AND ≠ 0: os dois
 * do mesmo lado de fora) ou corta o ponto de fora na borda que ele viola e repete.
 * Retorna o trecho visível ou `null`.
 */
export function recortarSegmento(p0: Ponto, p1: Ponto, j: Janela): [Ponto, Ponto] | null {
  let a = { ...p0 }
  let b = { ...p1 }
  let ca = codigoRegiao(a, j)
  let cb = codigoRegiao(b, j)
  for (let passos = 0; passos < 8; passos++) {
    if ((ca | cb) === 0) return [a, b]
    if ((ca & cb) !== 0) return null
    const fora = ca !== 0 ? ca : cb
    let p: Ponto
    if (fora & ACIMA) p = { x: a.x + ((b.x - a.x) * (j.y0 - a.y)) / (b.y - a.y), y: j.y0 }
    else if (fora & ABAIXO) p = { x: a.x + ((b.x - a.x) * (j.y1 - a.y)) / (b.y - a.y), y: j.y1 }
    else if (fora & DIREITA) p = { x: j.x1, y: a.y + ((b.y - a.y) * (j.x1 - a.x)) / (b.x - a.x) }
    else p = { x: j.x0, y: a.y + ((b.y - a.y) * (j.x0 - a.x)) / (b.x - a.x) }
    if (fora === ca) {
      a = p
      ca = codigoRegiao(a, j)
    } else {
      b = p
      cb = codigoRegiao(b, j)
    }
  }
  return null
}

// ---------- Recorte de polígonos: Sutherland–Hodgman ----------
type Borda = { dentro: (p: Ponto) => boolean; cruzar: (a: Ponto, b: Ponto) => Ponto }

function bordas(j: Janela): Borda[] {
  const emX = (x: number) => (a: Ponto, b: Ponto) => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) })
  const emY = (y: number) => (a: Ponto, b: Ponto) => ({ x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y })
  return [
    { dentro: (p) => p.x >= j.x0, cruzar: emX(j.x0) },
    { dentro: (p) => p.x <= j.x1, cruzar: emX(j.x1) },
    { dentro: (p) => p.y >= j.y0, cruzar: emY(j.y0) },
    { dentro: (p) => p.y <= j.y1, cruzar: emY(j.y1) },
  ]
}

/**
 * Sutherland–Hodgman: recorta o polígono contra cada uma das 4 bordas, em sequência. Para cada
 * aresta (anterior → atual): dentro→dentro guarda o atual; dentro→fora guarda a interseção;
 * fora→dentro guarda a interseção e o atual; fora→fora não guarda nada.
 */
export function recortarPoligono(pontos: Ponto[], j: Janela): Ponto[] {
  let saida = pontos
  for (const borda of bordas(j)) {
    const entrada = saida
    saida = []
    if (entrada.length === 0) break
    let anterior = entrada[entrada.length - 1]
    for (const atual of entrada) {
      const dAtual = borda.dentro(atual)
      const dAnterior = borda.dentro(anterior)
      if (dAtual) {
        if (!dAnterior) saida.push(borda.cruzar(anterior, atual))
        saida.push(atual)
      } else if (dAnterior) {
        saida.push(borda.cruzar(anterior, atual))
      }
      anterior = atual
    }
  }
  return saida
}

// ---------- Editor de recorte da foto (F3-T13) ----------
export type Retangulo = { x: number; y: number; largura: number; altura: number }

/** Retângulo arrastado "ao contrário" (largura/altura negativas) vira um retângulo normal. */
export function normalizarRetangulo(a: Ponto, b: Ponto): Retangulo {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), largura: Math.abs(b.x - a.x), altura: Math.abs(b.y - a.y) }
}

/** Interseção do retângulo com a imagem (o recorte nunca sai da foto); valores inteiros. */
export function limitarAImagem(r: Retangulo, img: Tamanho): Retangulo {
  const x0 = Math.max(0, Math.round(r.x))
  const y0 = Math.max(0, Math.round(r.y))
  const x1 = Math.min(img.largura, Math.round(r.x + r.largura))
  const y1 = Math.min(img.altura, Math.round(r.y + r.altura))
  return { x: x0, y: y0, largura: Math.max(0, x1 - x0), altura: Math.max(0, y1 - y0) }
}

export const LADO_MINIMO_PX = 64 // o mesmo limite do pipeline (ajuste.py)

/**
 * Matriz que leva um ponto da foto ORIGINAL (largura × altura) para a foto girada no sentido
 * horário — usada para desenhar a foto girada no editor. É a inversa da matriz do pipeline.
 */
export function matrizRotacaoHoraria(graus: number, img: Tamanho): Mat3 {
  const { largura: w, altura: h } = img
  switch (((graus % 360) + 360) % 360) {
    case 90:
      return [0, -1, h, 1, 0, 0, 0, 0, 1] // (x, y) -> (h − y, x)
    case 180:
      return [-1, 0, w, 0, -1, h, 0, 0, 1]
    case 270:
      return [0, 1, 0, -1, 0, w, 0, 0, 1] // (x, y) -> (y, w − x)
    default:
      return IDENTIDADE
  }
}

export function tamanhoGirado(graus: number, img: Tamanho): Tamanho {
  return (((graus % 360) + 360) % 360) % 180 === 0 ? img : { largura: img.altura, altura: img.largura }
}

/**
 * Contorno da foto ORIGINAL → pontos na TELA, já recortados: leva os pontos ao espaço exibido
 * (`mExibicao`, por exemplo a rotação do editor), recorta na `janelaRecorte` com
 * Sutherland–Hodgman e só então aplica a matriz janela → viewport.
 */
export function poligonoNaTela(
  pontos: [number, number][],
  mExibicao: Mat3,
  janela: Janela,
  viewport: Tamanho,
  janelaRecorte: Janela = janela,
): Ponto[] {
  const exibidos = pontos.map(([x, y]) => aplicar(mExibicao, { x, y }))
  const mTela = matrizJanelaViewport(janela, viewport)
  return recortarPoligono(exibidos, janelaRecorte).map((p) => aplicar(mTela, p))
}
