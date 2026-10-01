import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import ErroModelo from '../components/ErroModelo'
import ModelViewer from '../components/ModelViewer'
import { AMOSTRAS, arquivoValido } from '../lib/amostras'
import { MODOS, type ModoRender } from '../lib/modosRender'

export default function Visualizador() {
  const [modo, setModo] = useState<ModoRender>('solido')
  const [url, setUrl] = useState(AMOSTRAS[0].url)
  const [local, setLocal] = useState<{ nome: string; url: string } | null>(null)
  const [erro, setErro] = useState('')
  const atual = MODOS.find((m) => m.id === modo)!

  // Libera a URL temporária do arquivo local quando ela é trocada ou a página fecha
  useEffect(() => () => { if (local) URL.revokeObjectURL(local.url) }, [local])

  function abrirArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return
    if (!arquivoValido(arquivo.name)) {
      setErro('Esse formato não abre aqui. Escolha um arquivo .glb (gerado pelo RELEVO).')
      return
    }
    setErro('')
    const novo = { nome: arquivo.name, url: URL.createObjectURL(arquivo) }
    setLocal(novo)
    setUrl(novo.url)
  }

  return (
    <main className="container">
      <p><Link to="/">← Início</Link></p>
      <h1>Visualizador 3D</h1>

      <div className="toolbar" role="group" aria-label="Modelo">
        {AMOSTRAS.map((a) => (
          <button key={a.id} aria-pressed={url === a.url} onClick={() => setUrl(a.url)}>
            {a.rotulo}
          </button>
        ))}
        {local && (
          <button aria-pressed={url === local.url} onClick={() => setUrl(local.url)}>
            {local.nome}
          </button>
        )}
        <label className="botao-arquivo">
          Abrir arquivo .glb…
          <input type="file" accept=".glb,.gltf" onChange={abrirArquivo} hidden />
        </label>
      </div>
      {erro && <p role="alert" style={{ color: 'var(--accent)' }}>{erro}</p>}

      <div className="toolbar" role="group" aria-label="Modo de visualização">
        {MODOS.map((m) => (
          <button key={m.id} aria-pressed={m.id === modo} onClick={() => setModo(m.id)}>
            {m.rotulo}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--muted)' }}>Conceito: {atual.conceito}</p>
      <div className="viewer">
        <ErroModelo key={url}>
          <ModelViewer url={url} modo={modo} />
        </ErroModelo>
      </div>
    </main>
  )
}
