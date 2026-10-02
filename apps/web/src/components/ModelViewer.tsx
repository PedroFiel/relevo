import { OrbitControls, TransformControls, useGLTF, useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { fatorDaRoda, pontoDeZoom, zoomLente } from '../lib/camera'
import { ladoDoPlano, planoDeCorte, pontoNoPlano, type Vec3 } from '../lib/corte'
import { planosDaSelecao, separar, type Malha } from '../lib/selecao'
import type { ModoRender } from '../lib/modosRender'

const COR_NEUTRA = '#c9c3bb'
const COR_TAMPA = '#ff6b3d'

import {
  TRANSFORMACAO_INICIAL,
  type Caixa,
  type Comando,
  type Corte,
  type Cursor,
  type DadosRaios,
  type InfoCamera,
  type InfoSeparacao,
  type Transformacao,
  type Zoom,
} from '../lib/visualizador'

type Props = {
  url: string
  modo: ModoRender
  corte?: Corte
  zoom?: Zoom
  transformar?: { ativo: boolean; modo: 'translate' | 'rotate' | 'scale' }
  transformacao?: Transformacao
  onTransformar?: (t: Transformacao) => void
  onCursor?: (c: Cursor) => void
  onCaixa?: (c: Caixa) => void
  /** Plano near da câmera (cm): o recorte do volume de visão (frustum) que toda GPU faz. */
  near?: number
  comando?: Comando
  onCamera?: (c: InfoCamera) => void
  onCena?: (d: DadosRaios) => void
  /** Ferramenta "Separar": gizmo da parte separada (null = sem gizmo) e retorno das contas. */
  gizmoParte?: 'translate' | 'rotate' | null
  onSeparacao?: (s: InfoSeparacao | null) => void
}

// Mesma luz na rasterização e no rastreamento de raios; de cima e da esquerda, para a sombra cair
// do lado que a câmera inicial vê
const DIRECAO_LUZ: Vec3 = [-12, 30, 18]

const rad = (g: number) => (g * Math.PI) / 180
const graus = (r: number) => Math.round(((r * 180) / Math.PI) * 10) / 10
const arred = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100) as Vec3

/**
 * Materiais "invisíveis" que só escrevem no stencil buffer (técnica do exemplo
 * webgl_clipping_stencil do three.js): as faces de TRÁS da parte que sobrou do corte somam 1, as da
 * FRENTE subtraem 1. Onde o resultado ≠ 0 o raio da câmera entrou no sólido e não saiu: é ali que
 * a "tampa" do corte deve aparecer. Só funciona porque a malha é FECHADA (watertight).
 */
function materiaisStencil(plano: THREE.Plane) {
  const base = {
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    clippingPlanes: [plano],
  }
  const tras = new THREE.MeshBasicMaterial({
    ...base,
    side: THREE.BackSide,
    stencilFail: THREE.IncrementWrapStencilOp,
    stencilZFail: THREE.IncrementWrapStencilOp,
    stencilZPass: THREE.IncrementWrapStencilOp,
  })
  const frente = new THREE.MeshBasicMaterial({
    ...base,
    side: THREE.FrontSide,
    stencilFail: THREE.DecrementWrapStencilOp,
    stencilZFail: THREE.DecrementWrapStencilOp,
    stencilZPass: THREE.DecrementWrapStencilOp,
  })
  return [tras, frente]
}

function Modelo({
  url,
  modo,
  corte,
  plano,
  cursorRef,
  onCursor,
  onCaixa,
}: {
  url: string
  modo: ModoRender
  corte?: Corte
  plano: THREE.Plane
  cursorRef: MutableRefObject<THREE.Vector3 | null>
  onCursor?: (c: Cursor) => void
  onCaixa?: (c: Caixa) => void
}) {
  const { scene } = useGLTF(url)
  const cortar = !!corte?.ativo
  const tampa = cortar && !!corte?.tampa

  // Clona a cena e troca o material conforme o modo; com corte, liga o plano e o stencil
  const objeto = useMemo(() => {
    const clone = scene.clone(true)
    const malhas: THREE.Mesh[] = []
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) malhas.push(o)
    })
    for (const o of malhas) {
      // O pipeline grava a cor por vértice (atributo "color"); sem ela, usa cinza neutro.
      const temCor = o.geometry.hasAttribute('color')
      const material =
        modo === 'normais'
          ? new THREE.MeshNormalMaterial()
          : modo === 'wireframe'
            ? new THREE.MeshBasicMaterial({ color: '#ff6b3d', wireframe: true })
            : new THREE.MeshStandardMaterial({
                color: temCor ? '#ffffff' : COR_NEUTRA,
                vertexColors: temCor,
                roughness: 0.6,
                metalness: 0.05,
              })
      material.clippingPlanes = cortar ? [plano] : []
      // Sem tampa, o interior aparece: pintamos as faces de trás para ver "a casca"
      material.side = cortar && !tampa ? THREE.DoubleSide : THREE.FrontSide
      o.material = material
      o.renderOrder = 2
      if (tampa) {
        for (const m of materiaisStencil(plano)) {
          const filho = new THREE.Mesh(o.geometry, m)
          filho.renderOrder = 1
          filho.raycast = () => {} // invisível também para o raycasting
          o.add(filho)
        }
      }
    }
    return clone
  }, [scene, modo, cortar, tampa, plano])

  useEffect(() => {
    const caixa = new THREE.Box3().setFromObject(objeto)
    onCaixa?.({ min: arred(caixa.min), max: arred(caixa.max) })
  }, [objeto, onCaixa])

  // Libera os materiais criados acima quando o modo/modelo muda (evita vazamento de GPU)
  useEffect(
    () => () => {
      objeto.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose()
      })
    },
    [objeto],
  )

  // Rastreamento do cursor: o raycasting do r3f devolve TODAS as interseções do raio com os
  // triângulos; o three.js não sabe do plano de corte, então pulamos as que caíram na parte cortada.
  function aoMover(e: ThreeEvent<PointerEvent>) {
    const visivel = e.intersections.find(
      (i) => !cortar || ladoDoPlano([i.point.x, i.point.y, i.point.z], { normal: plano.normal.toArray() as Vec3, constante: plano.constant }) >= 0,
    )
    e.stopPropagation()
    if (!visivel?.face) {
      // Só acertou a parte cortada (ou a tampa): nada visível sob o cursor
      cursorRef.current = null
      onCursor?.(null)
      return
    }
    cursorRef.current = visivel.point.clone()
    const local = objeto.worldToLocal(visivel.point.clone())
    const normal = visivel.face.normal.clone().transformDirection(visivel.object.matrixWorld)
    onCursor?.({ modelo: arred(local), normal: arred(normal) })
  }

  return (
    <primitive
      object={objeto}
      onPointerMove={aoMover}
      onPointerOut={() => {
        cursorRef.current = null
        onCursor?.(null)
      }}
    />
  )
}

/** "Tampa" do corte: um plano grande sobre o plano de corte, pintado só onde o stencil ≠ 0. */
function Tampa({ plano }: { plano: THREE.Plane }) {
  const ref = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COR_TAMPA,
        roughness: 0.8,
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const p = pontoNoPlano({ normal: plano.normal.toArray() as Vec3, constante: plano.constant })
    m.position.set(...p)
    m.lookAt(p[0] - plano.normal.x, p[1] - plano.normal.y, p[2] - plano.normal.z)
  })
  return (
    <mesh
      ref={ref}
      material={material}
      renderOrder={1.1}
      onAfterRender={(renderer) => renderer.clearStencil()}
      raycast={() => {}}
    >
      <planeGeometry args={[200, 200]} />
    </mesh>
  )
}

/** Marcador do ponto rastreado sob o cursor. */
function Marcador({ cursorRef }: { cursorRef: MutableRefObject<THREE.Vector3 | null> }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.visible = !!cursorRef.current
    if (cursorRef.current) ref.current.position.copy(cursorRef.current)
  })
  return (
    <mesh ref={ref} raycast={() => {}} renderOrder={3}>
      <sphereGeometry args={[0.25, 16, 12]} />
      <meshBasicMaterial color="#ffd166" depthTest={false} />
    </mesh>
  )
}

type Orbita = { target: THREE.Vector3; update: () => void }

/** Aplica um fator de zoom: lente (muda o FOV) ou dolly (anda até o ponto sob o cursor/alvo). */
function ampliar(camera: THREE.Camera, orbita: Orbita | null, zoom: Zoom, fator: number, ponto: THREE.Vector3 | null) {
  if (zoom.tipo === 'lente' && camera instanceof THREE.PerspectiveCamera) {
    camera.fov = zoomLente(camera.fov, fator)
    camera.updateProjectionMatrix()
    return
  }
  if (!orbita) return
  const alvo = orbita.target
  const p = zoom.noPonto && ponto ? ponto : alvo
  const r = pontoDeZoom(camera.position.toArray() as Vec3, alvo.toArray() as Vec3, p.toArray() as Vec3, fator)
  camera.position.set(...r.camera)
  alvo.set(...r.alvo)
  orbita.update()
}

/** O marcador do cursor apontava para uma peça que pode ter sumido: esquece o último ponto. */
function limparCursor(cursorRef: MutableRefObject<THREE.Vector3 | null>) {
  cursorRef.current = null
}

function definirNear(camera: THREE.Camera, near: number) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return
  camera.near = near
  camera.updateProjectionMatrix()
}

/** Roda do mouse, comandos do painel (ampliar/enquadrar/raios), plano near e leitura da câmera. */
function ControleCamera({
  zoom,
  near,
  comando,
  cursorRef,
  grupo,
  plano,
  cortar,
  onCamera,
  onCena,
  aoSeparar,
}: {
  zoom: Zoom
  near: number
  comando?: Comando
  cursorRef: MutableRefObject<THREE.Vector3 | null>
  grupo: MutableRefObject<THREE.Group | null>
  plano: THREE.Plane
  cortar: boolean
  onCamera?: (c: InfoCamera) => void
  onCena?: (d: DadosRaios) => void
  aoSeparar: (parte: THREE.Mesh | null, info: InfoSeparacao | null) => void
}) {
  const { camera, gl, controls, size, scene } = useThree()
  const orbita = controls as unknown as Orbita | null

  useEffect(() => {
    function rodar(e: WheelEvent) {
      e.preventDefault()
      ampliar(camera, orbita, zoom, fatorDaRoda(e.deltaY), cursorRef.current)
    }
    const el = gl.domElement
    el.addEventListener('wheel', rodar, { passive: false })
    return () => el.removeEventListener('wheel', rodar)
  }, [camera, gl, orbita, zoom, cursorRef])

  // Plano near: tudo que está mais perto da câmera que isso é RECORTADO pela GPU
  useEffect(() => definirNear(camera, near), [camera, near])

  useEffect(() => {
    if (!comando) return
    if (comando.tipo === 'ampliar') ampliar(camera, orbita, { ...zoom, noPonto: false }, comando.fator, null)
    else if (comando.tipo === 'enquadrar' && grupo.current && orbita) {
      // Enquadrar: distância = raio da esfera envolvente / sen(fov/2), olhando para o centro
      const esfera = new THREE.Box3().setFromObject(grupo.current).getBoundingSphere(new THREE.Sphere())
      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 40
      const dist = esfera.radius / Math.sin(((fov / 2) * Math.PI) / 180)
      const dir = camera.position.clone().sub(orbita.target).normalize()
      orbita.target.copy(esfera.center)
      camera.position.copy(esfera.center).addScaledVector(dir, dist)
      orbita.update()
    } else if (comando.tipo === 'raios' && grupo.current && onCena) {
      // Desenha um quadro e copia o canvas JÁ (sem preserveDrawingBuffer o buffer é limpo depois)
      gl.render(scene, camera)
      const imagemRaster = gl.domElement.toDataURL('image/png')
      onCena({ ...capturarCena(grupo.current, camera, size, cortar ? plano : null), imagemRaster })
    } else if (comando.tipo === 'separar' && grupo.current) {
      juntar(grupo.current)
      const r = separarSelecao(grupo.current, camera, comando.retangulo)
      aoSeparar(r?.parte ?? null, r?.info ?? null)
    } else if (comando.tipo === 'juntar' && grupo.current) {
      juntar(grupo.current)
      aoSeparar(null, null)
    }
    if (comando.tipo === 'separar' || comando.tipo === 'juntar') limparCursor(cursorRef)
    // só reage a um NOVO comando (id)
  }, [comando?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leitura para o painel, ~5 vezes por segundo
  const ultima = useRef(0)
  useFrame(({ clock }) => {
    if (!onCamera || clock.elapsedTime - ultima.current < 0.2) return
    ultima.current = clock.elapsedTime
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 0
    const alvo = orbita?.target ?? new THREE.Vector3()
    onCamera({ distancia: camera.position.distanceTo(alvo), fov, near: (camera as THREE.PerspectiveCamera).near })
  })
  return null
}

/** Malha principal do modelo (pula as do stencil e as peças já separadas). */
function malhaDoModelo(grupo: THREE.Group): THREE.Mesh | null {
  const malhas: THREE.Mesh[] = []
  grupo.traverse((o) => {
    if (o instanceof THREE.Mesh && o.renderOrder === 2 && !o.userData.peca) malhas.push(o)
  })
  return malhas[0] ?? null
}

/** Desfaz a separação: apaga as peças e mostra a malha original de novo. */
function juntar(grupo: THREE.Group) {
  const pecas: THREE.Mesh[] = []
  grupo.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.peca) pecas.push(o)
  })
  for (const p of pecas) {
    p.removeFromParent()
    p.geometry.dispose()
    ;(p.material as THREE.Material).dispose()
  }
  const original = malhaDoModelo(grupo)
  if (original) original.visible = true
}

function malhaParaGeometria(m: Malha): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3))
  if (m.cor) g.setAttribute('color', new THREE.BufferAttribute(m.cor, 3))
  g.computeVertexNormals()
  return g
}

/**
 * Seleção por retângulo + separar: o retângulo da tela vira 4 planos (com a câmera), levados para
 * o espaço do OBJETO pela inversa da matriz do modelo; os triângulos são recortados contra eles
 * (Sutherland–Hodgman 3D) e viram duas malhas: a parte (que pode ser movida) e o resto.
 */
function separarSelecao(
  grupo: THREE.Group,
  camera: THREE.Camera,
  r: { x0: number; y0: number; x1: number; y1: number },
): { parte: THREE.Mesh; info: InfoSeparacao } | null {
  const malha = malhaDoModelo(grupo)
  if (!malha) return null
  const t0 = performance.now()
  malha.updateWorldMatrix(true, false)
  const paraObjeto = malha.matrixWorld.clone().invert()
  const local = (v: THREE.Vector3): Vec3 => v.applyMatrix4(paraObjeto).toArray() as Vec3
  // Cantos do retângulo desprojetados (NDC -> mundo -> objeto) e um ponto central de referência
  const desprojetar = (x: number, y: number) => local(new THREE.Vector3(x, y, 0.5).unproject(camera))
  const cantos: [Vec3, Vec3, Vec3, Vec3] = [
    desprojetar(r.x0, r.y0),
    desprojetar(r.x1, r.y0),
    desprojetar(r.x1, r.y1),
    desprojetar(r.x0, r.y1),
  ]
  const centro = desprojetar((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
  const cam = local(camera.getWorldPosition(new THREE.Vector3()))
  const planos = planosDaSelecao(cam, cantos, centro)

  const g = malha.geometry as THREE.BufferGeometry
  const p = g.getAttribute('position')
  const c = g.getAttribute('color')
  const pos = new Float32Array(p.count * 3)
  const cor = c ? new Float32Array(p.count * 3) : null
  for (let i = 0; i < p.count; i++) {
    pos.set([p.getX(i), p.getY(i), p.getZ(i)], 3 * i)
    if (c && cor) cor.set([c.getX(i), c.getY(i), c.getZ(i)], 3 * i) // getX já desnormaliza
  }
  const ind = g.getIndex()
  const idx = ind ? Array.from({ length: ind.count }, (_, i) => ind.getX(i)) : Array.from({ length: p.count }, (_, i) => i)
  const s = separar(pos, idx, cor, planos)
  if (s.parte.triangulos === 0) return null

  const base = malha.material as THREE.Material
  const criar = (m: Malha, ehParte: boolean) => {
    const mat = base.clone()
    mat.side = THREE.DoubleSide // o recorte deixa a peça aberta: mostramos o lado de dentro
    const geo = malhaParaGeometria(m)
    // A parte é centrada nela mesma (origem local = centro da caixa): assim as setas do gizmo
    // aparecem em cima da parte e girar a parte gira em torno do centro dela
    geo.computeBoundingBox()
    const centro = ehParte ? geo.boundingBox!.getCenter(new THREE.Vector3()) : null
    if (centro) geo.translate(-centro.x, -centro.y, -centro.z)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData.peca = ehParte ? 'parte' : 'resto'
    mesh.renderOrder = 2
    mesh.quaternion.copy(malha.quaternion)
    mesh.scale.copy(malha.scale)
    mesh.position.copy(malha.position)
    if (centro) mesh.position.add(centro.multiply(malha.scale).applyQuaternion(malha.quaternion))
    malha.parent!.add(mesh)
    return mesh
  }
  malha.visible = false
  criar(s.resto, false)
  const parte = criar(s.parte, true)
  return {
    parte,
    info: { triangulosParte: s.parte.triangulos, triangulosResto: s.resto.triangulos, cortados: s.cortados, ms: performance.now() - t0 },
  }
}

/** Junta a geometria do modelo no espaço do MUNDO + câmera, para o rastreamento de raios. */
function capturarCena(
  grupo: THREE.Group,
  camera: THREE.Camera,
  size: { width: number; height: number },
  plano: THREE.Plane | null,
): DadosRaios {
  const pos: number[] = []
  const idx: number[] = []
  const cores: number[] = []
  let temCor = true
  grupo.updateMatrixWorld(true)
  grupo.traverse((o) => {
    // pula as malhas do stencil e a original escondida pela separação
    if (!(o instanceof THREE.Mesh) || o.renderOrder === 1 || !o.visible) return
    const g = o.geometry as THREE.BufferGeometry
    const p = g.getAttribute('position')
    const c = g.getAttribute('color')
    temCor &&= !!c
    const base = pos.length / 3
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)
      pos.push(v.x, v.y, v.z)
      if (c) cores.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    const ind = g.getIndex()
    if (ind) for (let i = 0; i < ind.count; i++) idx.push(base + ind.getX(i))
    else for (let i = 0; i < p.count; i++) idx.push(base + i)
  })
  camera.updateMatrixWorld()
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert()
  const luz = new THREE.Vector3(...DIRECAO_LUZ).normalize()
  return {
    pos: new Float32Array(pos),
    idx: new Uint32Array(idx),
    cores: temCor ? new Float32Array(cores) : null,
    invViewProj: vp.elements.slice(),
    camera: camera.position.toArray() as Vec3,
    luz: luz.toArray() as Vec3,
    largura: size.width,
    altura: size.height,
    plano: plano ? { normal: plano.normal.toArray() as Vec3, constante: plano.constant } : null,
  }
}

/** Desenha o plano de corte (contorno + véu translúcido) para o usuário VER onde está cortando. */
function IndicadorPlano({ plano, tamanho }: { plano: THREE.Plane; tamanho: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const p = pontoNoPlano({ normal: plano.normal.toArray() as Vec3, constante: plano.constant })
    g.position.set(...p)
    g.lookAt(p[0] + plano.normal.x, p[1] + plano.normal.y, p[2] + plano.normal.z)
  })
  const borda = useMemo(() => {
    const h = tamanho / 2
    return new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0])
  }, [tamanho])
  return (
    <group ref={ref} raycast={() => {}}>
      <mesh raycast={() => {}} renderOrder={4}>
        <planeGeometry args={[tamanho, tamanho]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop raycast={() => {}}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[borda, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffd166" />
      </lineLoop>
    </group>
  )
}

function Cena(props: Props) {
  const { url, modo, corte, zoom, transformar, transformacao = TRANSFORMACAO_INICIAL, onTransformar, onCursor, onCaixa } = props
  const [tamanhoPlano, setTamanhoPlano] = useState(40)
  const [parte, setParte] = useState<THREE.Mesh | null>(null)
  const { onSeparacao } = props
  const aoSeparar = useCallback(
    (m: THREE.Mesh | null, info: InfoSeparacao | null) => {
      setParte(m)
      onSeparacao?.(info)
    },
    [onSeparacao],
  )
  // Estável (useCallback): o Modelo chama isto num efeito; uma função nova a cada render
  // disparava o efeito de novo -> setState -> render -> ... (laço infinito)
  const aoCaixa = useCallback(
    (c: Caixa) => {
      setTamanhoPlano(1.4 * Math.max(...c.max.map((v, i) => v - c.min[i])))
      onCaixa?.(c)
    },
    [onCaixa],
  )
  const grupo = useRef<THREE.Group>(null)
  const cursorRef = useRef<THREE.Vector3 | null>(null)
  // Um único THREE.Plane, atualizado no lugar: mover o slider não recria materiais
  const plano = useMemo(() => new THREE.Plane(), [])
  const eixo = corte?.eixo ?? 'x'
  const posicao = corte?.posicao ?? 0
  const inverter = corte?.inverter ?? false
  // O corte é definido nas coordenadas do MODELO (cm, como o slider) e acompanha o modelo quando
  // ele é movido/girado/aumentado: a cada quadro o plano é levado ao mundo pela matriz do grupo
  // (Plane.applyMatrix4 usa a inversa transposta para a normal).
  const base = useMemo(() => {
    const p = planoDeCorte(eixo, posicao, inverter)
    return new THREE.Plane(new THREE.Vector3(...p.normal), p.constante)
  }, [eixo, posicao, inverter])
  useFrame(() => {
    if (grupo.current) plano.copy(base).applyMatrix4(grupo.current.matrixWorld)
  })

  // Grupo controlado: os valores vêm do painel (campos numéricos/restaurar) ou do gizmo
  useEffect(() => {
    const g = grupo.current
    if (!g) return
    g.position.set(...transformacao.posicao)
    g.rotation.set(...(transformacao.rotacao.map(rad) as Vec3), 'XYZ')
    g.scale.setScalar(transformacao.escala)
  }, [transformacao])

  function aoTransformar() {
    const g = grupo.current
    if (!g || !onTransformar) return
    onTransformar({
      posicao: arred(g.position),
      rotacao: [graus(g.rotation.x), graus(g.rotation.y), graus(g.rotation.z)],
      escala: Math.round(((g.scale.x + g.scale.y + g.scale.z) / 3) * 1000) / 1000,
    })
  }

  return (
    <>
      <group ref={grupo}>
        {/* O pipeline já entrega o modelo em cm, centrado em x/z e apoiado no chão (y = 0) */}
        <Modelo key={url} url={url} modo={modo} corte={corte} plano={plano} cursorRef={cursorRef} onCursor={onCursor} onCaixa={aoCaixa} />
      </group>
      {corte?.ativo && corte.tampa && <Tampa plano={plano} />}
      {corte?.ativo && <IndicadorPlano plano={plano} tamanho={tamanhoPlano} />}
      <Marcador cursorRef={cursorRef} />
      {transformar?.ativo && (
        <TransformControls
          object={grupo as MutableRefObject<THREE.Object3D>}
          mode={transformar.modo}
          showY
          onObjectChange={() => {
            // Escala só uniforme ("aumentar"): iguala os 3 eixos ao que mudou
            const g = grupo.current
            if (g && transformar.modo === 'scale') g.scale.setScalar(Math.max(g.scale.x, g.scale.y, g.scale.z))
            aoTransformar()
          }}
        />
      )}
      <ControleCamera
        zoom={zoom ?? { tipo: 'dolly', noPonto: false }}
        near={props.near ?? 0.1}
        comando={props.comando}
        cursorRef={cursorRef}
        grupo={grupo}
        plano={plano}
        cortar={!!corte?.ativo}
        onCamera={props.onCamera}
        onCena={props.onCena}
        aoSeparar={aoSeparar}
      />
      {parte && parte.parent && props.gizmoParte && <TransformControls object={parte} mode={props.gizmoParte} />}
    </>
  )
}

/** Aviso de carregamento FORA do canvas: <Html> dentro do Suspense criava uma segunda raiz React
 * e dava erro de removeChild ao terminar de carregar. */
function Carregando() {
  const { active, progress } = useProgress()
  if (!active) return null
  return <div className="carregando">Carregando o modelo… {Math.round(progress)}%</div>
}

export default function ModelViewer(props: Props) {
  return (
    <>
    <Carregando />
    {/* Câmera perspectiva: fov 40°, planos near/far ajustados para objetos de ~30 cm.
        stencil: true — a tampa do corte usa o stencil buffer. */}
    <Canvas
      camera={{ position: [32, 22, 32], fov: 40, near: 0.1, far: 500 }}
      dpr={[1, 2]}
      gl={{ stencil: true }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true // planos de corte por material
      }}
    >
      <color attach="background" args={['#181b22']} />
      <hemisphereLight args={['#ffffff', '#444444', 1.2]} />
      <directionalLight position={DIRECAO_LUZ} intensity={2} />
      <Suspense fallback={null}>
        <Cena {...props} />
      </Suspense>
      {/* Grade de 2 cm por célula (o modelo está em centímetros) */}
      <gridHelper args={[60, 30, '#3a4150', '#262b35']} raycast={() => {}} />
      {/* A roda do mouse é tratada pelo ControleCamera (dolly no ponto ou lente) */}
      <OrbitControls makeDefault target={[0, 4, 0]} enableZoom={false} />
    </Canvas>
    </>
  )
}
