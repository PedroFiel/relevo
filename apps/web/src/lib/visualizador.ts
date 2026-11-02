/** Tipos e estado inicial compartilhados entre a página do visualizador e o ModelViewer. */
import type { PresetCamera } from './camera'
import type { Eixo, Vec3 } from './corte'

export type Corte = { ativo: boolean; eixo: Eixo; posicao: number; inverter: boolean; tampa: boolean }
export type Zoom = { noPonto: boolean }
export type Transformacao = { posicao: Vec3; rotacao: Vec3; escala: number }
export type Cursor = { modelo: Vec3; normal: Vec3 } | null
export type Caixa = { min: Vec3; max: Vec3 }

export type Iluminacao = {
  azimute: number
  elevacao: number
  ambiente: number
  direcional: number
  sombraChao: boolean
}

export const ILUMINACAO_INICIAL: Iluminacao = {
  azimute: -35,
  elevacao: 55,
  ambiente: 1.2,
  direcional: 2.0,
  sombraChao: true,
}

export type AuxiliaresCena = {
  grade: boolean
  eixos: boolean
  caixa: boolean
  ortografica: boolean
  lodAutomatico: boolean
}

export const AUXILIARES_INICIAIS: AuxiliaresCena = {
  grade: true,
  eixos: false,
  caixa: false,
  ortografica: false,
  lodAutomatico: false,
}

export type EstatisticasMalha = {
  vertices: number
  triangulos: number
  dimensoesCm: Vec3
}

export const TRANSFORMACAO_INICIAL: Transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: 1 }

/** Pedidos de ação vindos do painel (o `id` muda a cada clique para disparar de novo). */
export type Comando =
  | { id: number; tipo: 'ampliar'; fator: number }
  | { id: number; tipo: 'enquadrar' }
  | { id: number; tipo: 'preset'; preset: PresetCamera }
  | { id: number; tipo: 'raios' }
  /** retângulo em coordenadas normalizadas da tela (NDC: −1..1, y para cima) */
  | { id: number; tipo: 'separar'; retangulo: { x0: number; y0: number; x1: number; y1: number } }
  | { id: number; tipo: 'juntar' }

export type InfoSeparacao = { triangulosParte: number; triangulosResto: number; cortados: number; ms: number }

/**
 * Leitura da câmera para o painel. `frente`/`fundo`: distância (cm), ao longo do eixo de visão, do
 * ponto mais próximo/mais distante da esfera que envolve o modelo — é onde o plano near começa e
 * termina de cortar o tênis.
 */
export type InfoCamera = { distancia: number; fov: number; near: number; frente: number; fundo: number }

/** O near nunca chega a 0: a matriz de perspectiva divide por ele (e o z-buffer perde precisão). */
export const NEAR_MINIMO = 0.1

/**
 * Plano near a partir de "quanto do tênis cortar" (cm a partir da frente do modelo).
 * Profundidade 0 = nada cortado (near no mínimo); profundidade = fundo − frente = tudo cortado.
 */
export function nearDaProfundidade(profundidade: number, frente: number): number {
  if (profundidade <= 0) return NEAR_MINIMO
  return Math.max(NEAR_MINIMO, frente + profundidade)
}

/** Estatísticas geométricas da malha (F2-T07). */
export function calcularEstatisticas(vertices: number, triangulos: number, caixa: Caixa): EstatisticasMalha {
  const dimensoesCm: Vec3 = [
    Math.round((caixa.max[0] - caixa.min[0]) * 100) / 100,
    Math.round((caixa.max[1] - caixa.min[1]) * 100) / 100,
    Math.round((caixa.max[2] - caixa.min[2]) * 100) / 100,
  ]
  return { vertices, triangulos, dimensoesCm }
}

/** Distância euclidiana em centímetros entre dois pontos 3D na superfície do modelo (F5-T03). */
export function distanciaCm(p1: Vec3, p2: Vec3, escala = 1): number {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const dz = p2[2] - p1[2]
  return Math.round(Math.hypot(dx, dy, dz) * escala * 100) / 100
}

/**
 * Seleciona o nível de detalhe (LOD 0 = 100 %, LOD 1 = 25 %, LOD 2 = 5 %, F5-T02)
 * em função da distância da câmera ao modelo (em cm).
 */
export function nivelLodPorDistancia(
  distanciaCameraCm: number,
  triangulosBase: number,
): { nivel: 0 | 1 | 2; fracao: number; rotulo: string; triangulos: number } {
  if (distanciaCameraCm > 85) {
    return {
      nivel: 2,
      fracao: 0.05,
      rotulo: 'LOD 2 (5 %)',
      triangulos: Math.max(24, Math.round(triangulosBase * 0.05)),
    }
  }
  if (distanciaCameraCm > 50) {
    return {
      nivel: 1,
      fracao: 0.25,
      rotulo: 'LOD 1 (25 %)',
      triangulos: Math.max(24, Math.round(triangulosBase * 0.25)),
    }
  }
  return {
    nivel: 0,
    fracao: 1.0,
    rotulo: 'LOD 0 (100 %)',
    triangulos: triangulosBase,
  }
}

/**
 * Simplifica uma malha triangular por agrupamento espacial em grade uniforme
 * (Vertex Clustering — Rossignac & Borrel, 1993) para os níveis LOD 1 e LOD 2 (F5-T02).
 */
export function simplificarMalhaLod(
  posicoes: Float32Array,
  indices: Uint32Array | Uint16Array | null,
  cores: Float32Array | null,
  itemSizeCor: number,
  nivel: 0 | 1 | 2,
): {
  posicoes: Float32Array
  indices: Uint32Array
  cores: Float32Array | null
} {
  const numVerts = Math.floor(posicoes.length / 3)
  const numTriOrig = indices ? Math.floor(indices.length / 3) : Math.floor(numVerts / 3)
  if (nivel === 0 || numTriOrig <= 24) {
    const idxPadrao = new Uint32Array(numTriOrig * 3)
    if (indices) {
      for (let i = 0; i < idxPadrao.length; i++) idxPadrao[i] = indices[i]
    } else {
      for (let i = 0; i < idxPadrao.length; i++) idxPadrao[i] = i
    }
    return {
      posicoes: new Float32Array(posicoes),
      indices: idxPadrao,
      cores: cores ? new Float32Array(cores) : null,
    }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < numVerts; i++) {
    const x = posicoes[3 * i]
    const y = posicoes[3 * i + 1]
    const z = posicoes[3 * i + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }

  const spanX = Math.max(maxX - minX, 1e-5)
  const spanY = Math.max(maxY - minY, 1e-5)
  const spanZ = Math.max(maxZ - minZ, 1e-5)
  const maxSpan = Math.max(spanX, spanY, spanZ)
  const divisoes = nivel === 1 ? 28 : 12
  const passo = maxSpan / divisoes
  const gx = Math.max(2, Math.ceil(spanX / passo))
  const gy = Math.max(2, Math.ceil(spanY / passo))
  const gz = Math.max(2, Math.ceil(spanZ / passo))

  const mapaCelula = new Map<number, number>()
  const mapaVertice = new Uint32Array(numVerts)
  const somaPos: number[] = []
  const somaCor: number[] = []
  const contagem: number[] = []

  for (let i = 0; i < numVerts; i++) {
    const ix = Math.min(gx - 1, Math.max(0, Math.floor(((posicoes[3 * i] - minX) / spanX) * gx)))
    const iy = Math.min(gy - 1, Math.max(0, Math.floor(((posicoes[3 * i + 1] - minY) / spanY) * gy)))
    const iz = Math.min(gz - 1, Math.max(0, Math.floor(((posicoes[3 * i + 2] - minZ) / spanZ) * gz)))
    const chave = ix + gx * (iy + gy * iz)
    let idCluster = mapaCelula.get(chave)
    if (idCluster === undefined) {
      idCluster = contagem.length
      mapaCelula.set(chave, idCluster)
      somaPos.push(0, 0, 0)
      if (cores) {
        for (let c = 0; c < itemSizeCor; c++) somaCor.push(0)
      }
      contagem.push(0)
    }
    mapaVertice[i] = idCluster
    somaPos[3 * idCluster] += posicoes[3 * i]
    somaPos[3 * idCluster + 1] += posicoes[3 * i + 1]
    somaPos[3 * idCluster + 2] += posicoes[3 * i + 2]
    if (cores) {
      for (let c = 0; c < itemSizeCor; c++) {
        somaCor[itemSizeCor * idCluster + c] += cores[itemSizeCor * i + c]
      }
    }
    contagem[idCluster] += 1
  }

  const numClusters = contagem.length
  const novasPosicoes = new Float32Array(numClusters * 3)
  const novasCores = cores ? new Float32Array(numClusters * itemSizeCor) : null
  for (let k = 0; k < numClusters; k++) {
    const n = contagem[k]
    novasPosicoes[3 * k] = somaPos[3 * k] / n
    novasPosicoes[3 * k + 1] = somaPos[3 * k + 1] / n
    novasPosicoes[3 * k + 2] = somaPos[3 * k + 2] / n
    if (novasCores) {
      for (let c = 0; c < itemSizeCor; c++) {
        novasCores[itemSizeCor * k + c] = somaCor[itemSizeCor * k + c] / n
      }
    }
  }

  const novosIndicesLista: number[] = []
  for (let t = 0; t < numTriOrig; t++) {
    const v0 = indices ? indices[3 * t] : 3 * t
    const v1 = indices ? indices[3 * t + 1] : 3 * t + 1
    const v2 = indices ? indices[3 * t + 2] : 3 * t + 2
    const c0 = mapaVertice[v0]
    const c1 = mapaVertice[v1]
    const c2 = mapaVertice[v2]
    if (c0 !== c1 && c1 !== c2 && c2 !== c0) {
      novosIndicesLista.push(c0, c1, c2)
    }
  }

  if (novosIndicesLista.length < 12) {
    return simplificarMalhaLod(posicoes, indices, cores, itemSizeCor, 0)
  }

  return {
    posicoes: novasPosicoes,
    indices: new Uint32Array(novosIndicesLista),
    cores: novasCores,
  }
}

/** Tudo que o rastreamento de raios precisa, já no espaço do MUNDO. */
export type DadosRaios = {
  pos: Float32Array
  idx: Uint32Array
  cores: Float32Array | null
  invViewProj: number[]
  camera: Vec3
  luz: Vec3
  largura: number
  altura: number
  plano: { normal: Vec3; constante: number } | null
  /** A mesma vista, desenhada pela GPU (rasterização), para comparar lado a lado. */
  imagemRaster?: string
}
