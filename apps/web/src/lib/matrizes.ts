/**
 * Transformações geométricas com matrizes homogêneas 4×4 (F2-T13), escritas à mão para mostrar a
 * conta (o three.js faz o mesmo em `Matrix4.compose`).
 *
 * Coordenadas homogêneas: o ponto (x, y, z) vira (x, y, z, 1) e a TRANSLAÇÃO, que não é linear,
 * vira multiplicação de matriz como a rotação e a escala. Compor = multiplicar; a matriz da
 * DIREITA é aplicada primeiro: M = T·R·S escala, depois gira, depois move.
 */
import type { Vec3 } from './corte'

/** 4×4 em ordem de LINHAS: m[4*i + j] = linha i, coluna j. */
export type Mat4 = number[]

export function identidade4(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

export function multiplicar4(a: Mat4, b: Mat4): Mat4 {
  const r = new Array(16).fill(0)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[4 * i + j] += a[4 * i + k] * b[4 * k + j]
  return r
}

export function translacao4([tx, ty, tz]: Vec3): Mat4 {
  return [1, 0, 0, tx, 0, 1, 0, ty, 0, 0, 1, tz, 0, 0, 0, 1]
}

export function escala4([sx, sy, sz]: Vec3): Mat4 {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]
}

const rad = (g: number) => (g * Math.PI) / 180

export function rotacaoX(graus: number): Mat4 {
  const c = Math.cos(rad(graus))
  const s = Math.sin(rad(graus))
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]
}

export function rotacaoY(graus: number): Mat4 {
  const c = Math.cos(rad(graus))
  const s = Math.sin(rad(graus))
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]
}

export function rotacaoZ(graus: number): Mat4 {
  const c = Math.cos(rad(graus))
  const s = Math.sin(rad(graus))
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** Rotação por ângulos de Euler na ordem 'XYZ' do three.js: R = Rx · Ry · Rz. */
export function rotacaoEuler([gx, gy, gz]: Vec3): Mat4 {
  return multiplicar4(rotacaoX(gx), multiplicar4(rotacaoY(gy), rotacaoZ(gz)))
}

export type Ordem = 'TRS' | 'SRT'

/** Monta a matriz do objeto. 'TRS' (o padrão de todo motor 3D) = T·R·S; 'SRT' = S·R·T. */
export function compor(posicao: Vec3, rotacaoGraus: Vec3, esc: Vec3, ordem: Ordem = 'TRS'): Mat4 {
  const T = translacao4(posicao)
  const R = rotacaoEuler(rotacaoGraus)
  const S = escala4(esc)
  return ordem === 'TRS' ? multiplicar4(T, multiplicar4(R, S)) : multiplicar4(S, multiplicar4(R, T))
}

export function aplicar4(m: Mat4, [x, y, z]: Vec3): Vec3 {
  const w = m[12] * x + m[13] * y + m[14] * z + m[15]
  return [
    (m[0] * x + m[1] * y + m[2] * z + m[3]) / w,
    (m[4] * x + m[5] * y + m[6] * z + m[7]) / w,
    (m[8] * x + m[9] * y + m[10] * z + m[11]) / w,
  ]
}

/** Linhas formatadas para o painel "Matriz" (números com 2 casas, sinal alinhado). */
export function linhasDaMatriz(m: Mat4): string[] {
  const f = (v: number) => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2).padStart(7)
  return [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => f(m[4 * i + j])).join(' '))
}

/** Converte para o formato do three.js (`Matrix4.elements` é em ordem de COLUNAS). */
export function paraColunas(m: Mat4): number[] {
  return [0, 1, 2, 3].flatMap((j) => [0, 1, 2, 3].map((i) => m[4 * i + j]))
}
