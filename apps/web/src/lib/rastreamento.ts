/**
 * Rastreamento de raios (ray tracing) — o "rastrear" das ementas de Computação Gráfica.
 *
 * Em vez de projetar triângulos na tela (rasterização, o que a GPU faz no resto do visualizador),
 * fazemos o caminho inverso: para CADA PIXEL sai um raio da câmera; procuramos o primeiro
 * triângulo que ele atinge; dali sai um segundo raio em direção à luz (raio de sombra) — se ele
 * bater em algo, o ponto está na sombra. A cor é Lambert (difusa) com a cor por vértice do modelo.
 *
 * Para não testar 200 mil triângulos por raio usamos uma BVH (hierarquia de volumes envolventes):
 * uma árvore de caixas (AABB); se o raio não acerta a caixa, nada lá dentro é testado.
 *
 *   raio–caixa:      método das placas ("slab test")
 *   raio–triângulo:  Möller–Trumbore (coordenadas baricêntricas u, v)
 *
 * Tudo puro (sem three.js), para ser testável e explicável.
 */

export type V3 = [number, number, number]

const FOLHA = 8 // triângulos por folha da BVH

export type BVH = {
  pos: Float32Array // vértices (x, y, z) já no espaço do mundo
  idx: Uint32Array // 3 índices por triângulo
  tri: Uint32Array // ordem dos triângulos (as folhas apontam para faixas desta lista)
  caixas: Float32Array // por nó: AABB (x0, y0, z0, x1, y1, z1)
  nos: Int32Array // por nó: [esquerdo, direito, início, quantidade]; folha tem esquerdo = −1
  total: number
}

/** Constrói a BVH por divisão na mediana do maior eixo dos centroides (iterativa, sem recursão). */
export function construirBVH(pos: Float32Array, idx: Uint32Array): BVH {
  const nTri = idx.length / 3
  const centro = new Float32Array(nTri * 3)
  const tmin = new Float32Array(nTri * 3)
  const tmax = new Float32Array(nTri * 3)
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const a = pos[3 * idx[3 * t] + e]
      const b = pos[3 * idx[3 * t + 1] + e]
      const c = pos[3 * idx[3 * t + 2] + e]
      tmin[3 * t + e] = Math.min(a, b, c)
      tmax[3 * t + e] = Math.max(a, b, c)
      centro[3 * t + e] = (a + b + c) / 3
    }
  }
  const tri = new Uint32Array(nTri)
  for (let t = 0; t < nTri; t++) tri[t] = t
  // cada folha tem mais de FOLHA/2 triângulos (só divide quem passa de FOLHA) -> folhas <= n/4
  const maxNos = 2 * Math.ceil(nTri / 4) + 1
  const caixas = new Float32Array(maxNos * 6)
  const nos = new Int32Array(maxNos * 4)
  let total = 1
  const pilha: [number, number, number][] = [[0, 0, nTri]] // nó, início, fim
  while (pilha.length) {
    const [no, ini, fim] = pilha.pop()!
    // caixa do nó
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity
    for (let i = ini; i < fim; i++) {
      const t = tri[i]
      x0 = Math.min(x0, tmin[3 * t]); y0 = Math.min(y0, tmin[3 * t + 1]); z0 = Math.min(z0, tmin[3 * t + 2])
      x1 = Math.max(x1, tmax[3 * t]); y1 = Math.max(y1, tmax[3 * t + 1]); z1 = Math.max(z1, tmax[3 * t + 2])
      cx0 = Math.min(cx0, centro[3 * t]); cy0 = Math.min(cy0, centro[3 * t + 1]); cz0 = Math.min(cz0, centro[3 * t + 2])
      cx1 = Math.max(cx1, centro[3 * t]); cy1 = Math.max(cy1, centro[3 * t + 1]); cz1 = Math.max(cz1, centro[3 * t + 2])
    }
    caixas.set([x0, y0, z0, x1, y1, z1], no * 6)
    const n = fim - ini
    if (n <= FOLHA) {
      nos.set([-1, -1, ini, n], no * 4)
      continue
    }
    // eixo de maior extensão dos centroides; particiona na mediana (quickselect por ordenação parcial)
    const ext = [cx1 - cx0, cy1 - cy0, cz1 - cz0]
    const eixo = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2
    const meio = (ini + fim) >> 1
    const faixa = Array.from(tri.subarray(ini, fim))
    faixa.sort((a, b) => centro[3 * a + eixo] - centro[3 * b + eixo])
    tri.set(faixa, ini)
    const esq = total++
    const dir = total++
    nos.set([esq, dir, 0, 0], no * 4)
    pilha.push([esq, ini, meio], [dir, meio, fim])
  }
  return { pos, idx, tri, caixas, nos, total }
}

/** Teste das placas: o raio atravessa a caixa entre tEntrada e tSaída? (invDir = 1 / direção) */
function acertaCaixa(c: Float32Array, k: number, o: V3, inv: V3, tMax: number): boolean {
  let t0 = 0
  let t1 = tMax
  for (let e = 0; e < 3; e++) {
    let a = (c[k + e] - o[e]) * inv[e]
    let b = (c[k + 3 + e] - o[e]) * inv[e]
    if (a > b) [a, b] = [b, a]
    t0 = a > t0 ? a : t0
    t1 = b < t1 ? b : t1
    if (t0 > t1) return false
  }
  return true
}

/**
 * Möller–Trumbore: resolve o + t·d = (1 − u − v)·A + u·B + v·C com a regra de Cramer.
 * Retorna t (distância ao longo do raio) ou −1 se não acertar.
 */
export function raioTriangulo(o: V3, d: V3, A: V3, B: V3, C: V3): { t: number; u: number; v: number } | null {
  const e1: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
  const e2: V3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
  const p: V3 = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]
  if (Math.abs(det) < 1e-12) return null // raio paralelo ao triângulo
  const inv = 1 / det
  const s: V3 = [o[0] - A[0], o[1] - A[1], o[2] - A[2]]
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv
  if (u < 0 || u > 1) return null
  const q: V3 = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv
  if (v < 0 || u + v > 1) return null
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv
  return t > 1e-6 ? { t, u, v } : null
}

export type Acerto = { t: number; tri: number; u: number; v: number }

/** Primeiro triângulo atingido pelo raio (ou null). `aceita` filtra pontos (ex.: plano de corte). */
export function intersectar(bvh: BVH, o: V3, d: V3, tMax = Infinity, qualquer = false, aceita?: (p: V3) => boolean): Acerto | null {
  const inv: V3 = [1 / d[0], 1 / d[1], 1 / d[2]]
  const { pos, idx, tri, caixas, nos } = bvh
  let melhor: Acerto | null = null
  let limite = tMax
  const pilha = [0]
  const A: V3 = [0, 0, 0], B: V3 = [0, 0, 0], C: V3 = [0, 0, 0]
  while (pilha.length) {
    const no = pilha.pop()!
    if (!acertaCaixa(caixas, no * 6, o, inv, limite)) continue
    const k = no * 4
    if (nos[k] >= 0) {
      pilha.push(nos[k], nos[k + 1])
      continue
    }
    for (let i = nos[k + 2], fim = i + nos[k + 3]; i < fim; i++) {
      const t = tri[i]
      for (let e = 0; e < 3; e++) {
        A[e] = pos[3 * idx[3 * t] + e]
        B[e] = pos[3 * idx[3 * t + 1] + e]
        C[e] = pos[3 * idx[3 * t + 2] + e]
      }
      const r = raioTriangulo(o, d, A, B, C)
      if (!r || r.t >= limite) continue
      if (aceita && !aceita([o[0] + r.t * d[0], o[1] + r.t * d[1], o[2] + r.t * d[2]])) continue
      melhor = { t: r.t, tri: t, u: r.u, v: r.v }
      limite = r.t
      if (qualquer) return melhor // raio de sombra: basta saber que bateu em algo
    }
  }
  return melhor
}

export type Cena = {
  bvh: BVH
  cores: Float32Array | null // cor por vértice (linear, 0..1), 3 por vértice
  luz: V3 // direção PARA a luz (unitária)
  aceita?: (p: V3) => boolean
}

const AMBIENTE = 0.25
const COR_PADRAO: V3 = [0.6, 0.58, 0.55]
const CHAO: V3 = [0.42, 0.44, 0.48]
const CEU: V3 = [0.09, 0.1, 0.13]
const SOMBRA_CHAO = 0.3 // o chão na sombra fica com 30 % da luz
export const LUZ_AMBIENTE = AMBIENTE

const normalizar = (v: V3): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}

/** O que aconteceu com um raio — usado para pintar o pixel e para EXPLICAR o pixel clicado. */
export type Explicacao = {
  alvo: 'modelo' | 'chao' | 'fundo'
  t: number // distância da câmera até o ponto atingido (cm)
  ponto: V3 | null
  triangulo: number | null
  normal: V3 | null
  lambert: number // cos(ângulo entre a normal e a luz), 0..1
  sombra: boolean // o raio de sombra até a luz bateu em algo?
  base: V3 // cor do material (linear): da foto (modelo) ou do chão
  cor: V3 // cor final (linear)
}

/** Segue um raio: primeiro acerto (modelo ou chão y = 0), raio de sombra e Lambert. */
export function explicarRaio(cena: Cena, o: V3, d: V3): Explicacao {
  const { bvh, cores, luz } = cena
  const hit = intersectar(bvh, o, d, Infinity, false, cena.aceita)
  const tChao = d[1] < 0 ? -o[1] / d[1] : Infinity
  if (hit && hit.t < tChao) {
    const t = hit.tri
    const ia = bvh.idx[3 * t], ib = bvh.idx[3 * t + 1], ic = bvh.idx[3 * t + 2]
    const P = (i: number): V3 => [bvh.pos[3 * i], bvh.pos[3 * i + 1], bvh.pos[3 * i + 2]]
    const A = P(ia), B = P(ib), C = P(ic)
    let n = normalizar([
      (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]),
      (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]),
      (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
    ])
    if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] > 0) n = [-n[0], -n[1], -n[2]] // face vista por trás
    const w = 1 - hit.u - hit.v
    // Cor do ponto = média das cores dos 3 vértices pesada pelas coordenadas baricêntricas
    const base: V3 = cores
      ? [0, 1, 2].map((e) => w * cores[3 * ia + e] + hit.u * cores[3 * ib + e] + hit.v * cores[3 * ic + e]) as V3
      : COR_PADRAO
    const p: V3 = [o[0] + hit.t * d[0], o[1] + hit.t * d[1], o[2] + hit.t * d[2]]
    const lambert = Math.max(0, n[0] * luz[0] + n[1] * luz[1] + n[2] * luz[2])
    // Raio de sombra sai um pouquinho acima da superfície (senão bate no próprio triângulo)
    const origemSombra: V3 = [p[0] + n[0] * 1e-3, p[1] + n[1] * 1e-3, p[2] + n[2] * 1e-3]
    const sombra = lambert > 0 && !!intersectar(bvh, origemSombra, luz, Infinity, true, cena.aceita)
    const k = AMBIENTE + (1 - AMBIENTE) * lambert * (sombra ? 0 : 1)
    return { alvo: 'modelo', t: hit.t, ponto: p, triangulo: t, normal: n, lambert, sombra, base, cor: [base[0] * k, base[1] * k, base[2] * k] }
  }
  if (tChao < Infinity) {
    const p: V3 = [o[0] + tChao * d[0], 1e-3, o[2] + tChao * d[2]]
    const sombra = !!intersectar(bvh, p, luz, Infinity, true, cena.aceita)
    const k = sombra ? SOMBRA_CHAO : 1
    return { alvo: 'chao', t: tChao, ponto: p, triangulo: null, normal: [0, 1, 0], lambert: luz[1], sombra, base: CHAO, cor: [CHAO[0] * k, CHAO[1] * k, CHAO[2] * k] }
  }
  return { alvo: 'fundo', t: Infinity, ponto: null, triangulo: null, normal: null, lambert: 0, sombra: false, base: CEU, cor: CEU }
}

/** Cor (linear) vista por um raio. */
export function corDoRaio(cena: Cena, o: V3, d: V3): V3 {
  return explicarRaio(cena, o, d).cor
}

/** Raio da câmera para o pixel (x, y): desprojeta o ponto NDC com a inversa de (projeção·vista). */
export function raioDoPixel(invViewProj: number[], camera: V3, x: number, y: number, largura: number, altura: number): V3 {
  const nx = ((x + 0.5) / largura) * 2 - 1
  const ny = 1 - ((y + 0.5) / altura) * 2
  const m = invViewProj // ordem de COLUNAS (three.js)
  const px = m[0] * nx + m[4] * ny + m[8] * 0.5 + m[12]
  const py = m[1] * nx + m[5] * ny + m[9] * 0.5 + m[13]
  const pz = m[2] * nx + m[6] * ny + m[10] * 0.5 + m[14]
  const pw = m[3] * nx + m[7] * ny + m[11] * 0.5 + m[15]
  return normalizar([px / pw - camera[0], py / pw - camera[1], pz / pw - camera[2]])
}

/** Linear → sRGB (8 bits), para escrever no ImageData. */
export function paraSRGB(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}
