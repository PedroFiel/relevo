import { useState } from 'react'
import { useParams } from 'react-router-dom'
import ErroModelo from '../components/ErroModelo'
import ModelViewer from '../components/ModelViewer'
import { urlApi } from '../lib/api'
import { useModeloPublico } from '../lib/consultas'
import type { ModoRender } from '../lib/modosRender'

/**
 * Visualizador 3D público incorporável via `<iframe>` (`/embed/:id`, F5-T06).
 * Sem cabeçalho nem rodapé da aplicação: ocupa 100 % da janela do iframe com o canvas 3D
 * e uma barra flutuante compacta (nome do modelo, dimensões e alternância Sólido / Wireframe).
 */
export default function EmbedModelo() {
  const { id = '' } = useParams()
  const publico = useModeloPublico(id)
  const [modo, setModo] = useState<ModoRender>('solido')

  if (publico.isPending) {
    return (
      <main className="embed-container embed-estado">
        <p className="conceito">Carregando modelo 3D…</p>
      </main>
    )
  }

  if (publico.isError || !publico.data) {
    return (
      <main className="embed-container embed-estado">
        <p role="alert">{publico.error?.message ?? 'Modelo público não encontrado.'}</p>
      </main>
    )
  }

  const dados = publico.data

  return (
    <main className="embed-container" aria-label={`Modelo 3D: ${dados.nome}`}>
      <div className="embed-topo">
        <div className="embed-titulo">
          <strong>{dados.nome}</strong>
          <span>
            {dados.comprimento_cm.toLocaleString('pt-BR')} cm
            {dados.faces ? ` · ${dados.faces.toLocaleString('pt-BR')} faces` : ''}
          </span>
        </div>
        <div className="embed-controles" role="group" aria-label="Modo de exibição">
          <button
            type="button"
            aria-pressed={modo === 'solido'}
            onClick={() => setModo('solido')}
          >
            Sólido
          </button>
          <button
            type="button"
            aria-pressed={modo === 'wireframe'}
            onClick={() => setModo('wireframe')}
          >
            Malha
          </button>
          <a
            href={`/modelos/${dados.id}`}
            target="_blank"
            rel="noreferrer"
            className="embed-marca"
          >
            RELEVO 3D ↗
          </a>
        </div>
      </div>
      <div className="embed-palco">
        <ErroModelo key={dados.glb_url}>
          <ModelViewer url={urlApi(dados.glb_url)} modo={modo} />
        </ErroModelo>
      </div>
    </main>
  )
}
