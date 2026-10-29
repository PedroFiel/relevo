import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { IdPasso } from '../lib/raioX'

type Props = {
  passo: IdPasso
  voxels?: string
  bruta?: string
  final?: string
  /** Lado do voxel em cm (para o tamanho do cubo de cada instância). */
  ladoVoxel: number
}

const COR_ARAME = '#ff8a63'
const COR_VOXEL = '#ff6b3d'

/** Opacidade que anda até o alvo a cada quadro (o crossfade entre etapas) e esconde o que zerou. */
function useEsmaecer<T extends THREE.Mesh>(alvo: number) {
  const objeto = useRef<T>(null)
  useFrame((_, dt) => {
    const o = objeto.current
    if (!o) return
    const material = o.material as THREE.Material
    material.opacity += (alvo - material.opacity) * Math.min(1, dt * 5)
    if (Math.abs(alvo - material.opacity) < 0.005) material.opacity = alvo
    material.depthWrite = material.opacity > 0.98 // meio transparente não esconde o que está atrás
    o.visible = material.opacity > 0.01
  })
  return objeto
}

function primeira<T extends THREE.Object3D>(cena: THREE.Object3D, teste: (o: THREE.Object3D) => boolean): T | null {
  let achado: T | null = null
  cena.traverse((o) => {
    if (!achado && teste(o)) achado = o as T
  })
  return achado
}

/** Voxels de superfície: UM InstancedMesh — a mesma caixa repetida N vezes com uma matriz 4×4 por instância. */
function Voxels({ url, lado, alvo }: { url: string; lado: number; alvo: number }) {
  const { scene } = useGLTF(url)
  const pontos = useMemo(() => primeira<THREE.Points>(scene, (o) => (o as THREE.Points).isPoints)?.geometry.getAttribute('position'), [scene])
  const caixa = useMemo(() => new THREE.BoxGeometry(lado * 0.9, lado * 0.9, lado * 0.9), [lado])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: COR_VOXEL, roughness: 0.6, transparent: true, opacity: 0 }), [])
  const ref = useEsmaecer<THREE.InstancedMesh>(alvo)
  useEffect(() => () => { caixa.dispose(); material.dispose() }, [caixa, material])
  useLayoutEffect(() => {
    const malha = ref.current
    if (!malha || !pontos) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < pontos.count; i++) {
      m.makeTranslation(pontos.getX(i), pontos.getY(i), pontos.getZ(i))
      malha.setMatrixAt(i, m)
    }
    malha.instanceMatrix.needsUpdate = true
    malha.computeBoundingSphere()
  }, [pontos, ref])
  if (!pontos) return null
  return <instancedMesh ref={ref} args={[caixa, material, pontos.count]} />
}

/** Malha do GLB em arame (bruta, decimada) ou com a cor por vértice (final). */
function Malha({ url, modo, alvo }: { url: string; modo: 'arame' | 'cor'; alvo: number }) {
  const { scene } = useGLTF(url)
  const geometria = useMemo(() => primeira<THREE.Mesh>(scene, (o) => (o as THREE.Mesh).isMesh)?.geometry ?? null, [scene])
  const material = useMemo(
    () =>
      modo === 'arame'
        ? new THREE.MeshBasicMaterial({ color: COR_ARAME, wireframe: true, transparent: true, opacity: 0 })
        : new THREE.MeshStandardMaterial({
            vertexColors: Boolean(geometria?.getAttribute('color')),
            color: geometria?.getAttribute('color') ? '#ffffff' : '#c9c3bb',
            roughness: 0.8,
            transparent: true,
            opacity: 0,
          }),
    [modo, geometria],
  )
  const ref = useEsmaecer<THREE.Mesh>(alvo)
  useEffect(() => () => material.dispose(), [material])
  if (!geometria) return null
  return <mesh ref={ref} geometry={geometria} material={material} />
}

/**
 * Palco 3D do Raio-X (F5-T01). Fica montado o tempo todo: a câmera não muda entre as etapas e cada
 * objeto só sobe ou desce a opacidade (crossfade).
 */
export default function CenaRaioX({ passo, voxels, bruta, final, ladoVoxel }: Props) {
  const alvo = (id: IdPasso) => (passo === id ? 1 : 0)
  return (
    <Canvas camera={{ position: [30, 20, 30], fov: 40, near: 0.1, far: 500 }} dpr={[1, 2]}>
      <color attach="background" args={['#181b22']} />
      <hemisphereLight args={['#ffffff', '#444444', 1.2]} />
      <directionalLight position={[20, 30, 15]} intensity={2} />
      <Suspense fallback={null}>
        {voxels && <Voxels url={voxels} lado={ladoVoxel} alvo={alvo('voxels')} />}
        {bruta && <Malha url={bruta} modo="arame" alvo={alvo('bruta')} />}
        {final && <Malha url={final} modo="arame" alvo={alvo('decimada')} />}
        {final && <Malha url={final} modo="cor" alvo={alvo('final')} />}
      </Suspense>
      <gridHelper args={[60, 30, '#3a4150', '#262b35']} />
      <OrbitControls makeDefault target={[0, 4, 0]} />
    </Canvas>
  )
}
