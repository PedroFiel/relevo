import { useState } from 'react'
import { Link } from 'react-router-dom'
import ModelViewer from '../components/ModelViewer'
import { MODOS, type ModoRender } from '../lib/modosRender'

const MODELO_EXEMPLO = '/samples/tenis-exemplo.glb'

export default function Visualizador() {
  const [modo, setModo] = useState<ModoRender>('solido')
  const atual = MODOS.find((m) => m.id === modo)!

  return (
    <main className="container">
      <p><Link to="/">← Início</Link></p>
      <h1>Visualizador 3D</h1>
      <div className="toolbar" role="group" aria-label="Modo de visualização">
        {MODOS.map((m) => (
          <button key={m.id} aria-pressed={m.id === modo} onClick={() => setModo(m.id)}>
            {m.rotulo}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--muted)' }}>Conceito: {atual.conceito}</p>
      <div className="viewer">
        <ModelViewer url={MODELO_EXEMPLO} modo={modo} />
      </div>
    </main>
  )
}
