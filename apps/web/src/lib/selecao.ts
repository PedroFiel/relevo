/**
 * Selecionar uma área e separá-la ("recortar e mover") — F2-T14.
 *
 * É o que editores 3D chamam de seleção por caixa + separar (Blender: B e depois P → Seleção;
 * Meshmixer: Select → Separate) e editores 2D chamam de seleção retangular + recortar + mover.
 *
 * 1. O retângulo desenhado na TELA vira um volume no 3D: cada lado do retângulo, junto com a
 *    câmera, define um plano (é um pedaço do frustum da câmera — a "janela de seleção").
 * 2. Cada triângulo é classificado contra os 4 planos (distância com sinal n·p + d):
 *    todo dentro -> parte; todo fora de algum plano -> resto; senão é RECORTADO.
 * 3. Recorte de polígono contra plano = Sutherland–Hodgman em 3D (o mesmo do 2D, trocando a
 *    borda da janela por um plano). Cada plano divide o polígono em um pedaço dentro e um fora;
 *    o de fora vai para o resto e o de dentro segue para o próximo plano. A cor do vértice novo
 *    é interpolada junto com a posição.
 */

export type V3 = [number, number, number]
export type Plano = { n: V3; d: number } // dentro: n·p + d >= 0
type Vertice = { p: V3; c: V3 }

export type Malha = { pos: Float32Array; cor: Float32Array | null; triangulos: number }
export type Separacao = { parte: Malha; resto: Malha; cortados: number }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export function distancia(pl: Plano, p: V3): number {
  return dot(pl.n, p) + pl.d
}

/** Plano pelos pontos a, b, c, orientado para que `dentro` fique do lado positivo. */
export function planoPor(a: V3, b: V3, c: V3, dentro: V3): Plano {
  let n = cruz(sub(b, a), sub(c, a))
  const len = Math.hypot(...n) || 1
  n = [n[0] / len, n[1] / len, n[2] / len]
  let pl: Plano = { n, d: -dot(n, a) }
  if (distancia(pl, dentro) < 0) pl = { n: [-n[0], -n[1], -n[2]], d: -pl.d }
  return pl
}

/**
 * Os 4 planos laterais do volume de seleção. `cantos` = os 4 cantos do retângulo já levados ao
 * mundo (desprojetados), `camera` = posição da câmera, `centro` = um ponto dentro do volume.
 */
export function planosDaSelecao(camera: V3, cantos: [V3, V3, V3, V3], centro: V3): Plano[] {
  return [0, 1, 2, 3].map((i) => planoPor(camera, cantos[i], cantos[(i + 1) % 4], centro))
}

/** Sutherland–Hodgman contra UM plano, devolvendo os dois lados (dentro e fora). */
export function dividirPoligono(poligono: Vertice[], pl: Plano): { dentro: Vertice[]; fora: Vertice[] } {
  const dentro: Vertice[] = []
  const fora: Vertice[] = []
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]
    const b = poligono[(i + 1) % poligono.length]
    const da = distancia(pl, a.p)
    const db = distancia(pl, b.p)
    if (da >= 0) dentro.push(a)
    else fora.push(a)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db) // onde a aresta cruza o plano
      const x = { p: lerp(a.p, b.p, t), c: lerp(a.c, b.c, t) }
      dentro.push(x)
      fora.push(x)
    }
  }
  return { dentro, fora }
}

class Acumulador {
  pos: number[] = []
  cor: number[] = []
  /** Triangula um polígono convexo em leque (v0, vi, vi+1). */
  leque(poli: Vertice[]) {
    for (let i = 1; i + 1 < poli.length; i++)
      for (const v of [poli[0], poli[i], poli[i + 1]]) {
        this.pos.push(...v.p)
        this.cor.push(...v.c)
      }
  }
  malha(comCor: boolean): Malha {
    return { pos: new Float32Array(this.pos), cor: comCor ? new Float32Array(this.cor) : null, triangulos: this.pos.length / 9 }
  }
}

/**
 * Separa a malha indexada (`pos` 3 por vértice, `idx` 3 por triângulo, `cor` opcional) pelos
 * planos do volume de seleção. Saída sem índices (cada triângulo com seus 3 vértices).
 */
export function separar(pos: Float32Array, idx: ArrayLike<number>, cor: Float32Array | null, planos: Plano[]): Separacao {
  const parte = new Acumulador()
  const resto = new Acumulador()
  let cortados = 0
  const V = (i: number): Vertice => ({
    p: [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]],
    c: cor ? [cor[3 * i], cor[3 * i + 1], cor[3 * i + 2]] : [0, 0, 0],
  })
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [V(idx[t]), V(idx[t + 1]), V(idx[t + 2])]
    // Classificação rápida: todo dentro de todos os planos, ou todo fora de algum
    let todoDentro = true
    let todoFora = false
    for (const pl of planos) {
      const ds = tri.map((v) => distancia(pl, v.p))
      if (ds.some((d) => d < 0)) todoDentro = false
      if (ds.every((d) => d < 0)) {
        todoFora = true
        break
      }
    }
    if (todoFora) {
      resto.leque(tri)
      continue
    }
    if (todoDentro) {
      parte.leque(tri)
      continue
    }
    cortados++
    let atual = tri
    for (const pl of planos) {
      const { dentro, fora } = dividirPoligono(atual, pl)
      if (fora.length >= 3) resto.leque(fora)
      atual = dentro
      if (atual.length < 3) break
    }
    if (atual.length >= 3) parte.leque(atual)
  }
  return { parte: parte.malha(!!cor), resto: resto.malha(!!cor), cortados }
}

/** Área total (para testes: recortar não cria nem perde área). */
export function area(m: Malha): number {
  let a = 0
  for (let i = 0; i < m.pos.length; i += 9) {
    const A: V3 = [m.pos[i], m.pos[i + 1], m.pos[i + 2]]
    const B: V3 = [m.pos[i + 3], m.pos[i + 4], m.pos[i + 5]]
    const C: V3 = [m.pos[i + 6], m.pos[i + 7], m.pos[i + 8]]
    a += Math.hypot(...cruz(sub(B, A), sub(C, A))) / 2
  }
  return a
}
