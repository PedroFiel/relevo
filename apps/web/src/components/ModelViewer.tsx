import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import type { ModoRender } from '../lib/modosRender'

function Modelo({ url, modo }: { url: string; modo: ModoRender }) {
  const { scene } = useGLTF(url)

  // Clona a cena e troca o material conforme o modo de visualização
  const objeto = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material =
          modo === 'normais'
            ? new THREE.MeshNormalMaterial()
            : modo === 'wireframe'
              ? new THREE.MeshBasicMaterial({ color: '#ff6b3d', wireframe: true })
              : new THREE.MeshStandardMaterial({ color: '#c9c3bb', roughness: 0.6, metalness: 0.05 })
      }
    })
    return clone
  }, [scene, modo])

  return <primitive object={objeto} />
}

export default function ModelViewer({ url, modo }: { url: string; modo: ModoRender }) {
  return (
    // Câmera perspectiva: fov 40°, planos near/far ajustados para objetos de ~30 cm
    <Canvas camera={{ position: [32, 22, 32], fov: 40, near: 0.1, far: 500 }} dpr={[1, 2]}>
      <color attach="background" args={['#181b22']} />
      <hemisphereLight args={['#ffffff', '#444444', 1.2]} />
      <directionalLight position={[20, 30, 10]} intensity={2} />
      <Suspense fallback={null}>
        {/* O pipeline já entrega o modelo em cm, centrado em x/z e apoiado no chão (y = 0) */}
        <Modelo url={url} modo={modo} />
      </Suspense>
      {/* Grade de 2 cm por célula (o modelo está em centímetros) */}
      <gridHelper args={[60, 30, '#3a4150', '#262b35']} />
      <OrbitControls makeDefault target={[0, 4, 0]} />
    </Canvas>
  )
}
