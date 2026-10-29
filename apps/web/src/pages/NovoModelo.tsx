import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import EditorFoto from '../components/EditorFoto'
import UploadSlot from '../components/UploadSlot'
import { Botao, GrupoBotoes, Painel } from '../components/ui'
import { useCriarModelo } from '../lib/consultas'
import { OBRIGATORIAS, QUALIDADES, VISTAS_EXTRAS, VISTAS_PRINCIPAIS, pendencias } from '../lib/upload'
import { SEM_AJUSTE, type AjusteFoto, type Vista } from '../lib/vistas'

/** Novo modelo (F3-T08 + F3-T13): fotos guiadas por gabarito, ajuste de cada foto, tamanho real e qualidade. */
export default function NovoModelo() {
  const navegar = useNavigate()
  const criar = useCriarModelo()
  const [nome, setNome] = useState('')
  const [comprimento, setComprimento] = useState<number | ''>('')
  const [qualidade, setQualidade] = useState('padrao')
  const [fotos, setFotos] = useState<Partial<Record<Vista, File>>>({})
  const [ajustes, setAjustes] = useState<Partial<Record<Vista, AjusteFoto>>>({})
  const [editando, setEditando] = useState<Vista | null>(null)

  const faltas = pendencias({ nome, comprimento_cm: comprimento, fotos })
  const resolucao = QUALIDADES.find((q) => q.id === qualidade)!.resolucao

  function trocarFoto(vista: Vista, arquivo: File | null) {
    setFotos((f) => {
      const novo = { ...f }
      if (arquivo) novo[vista] = arquivo
      else delete novo[vista]
      return novo
    })
    setAjustes((a) => ({ ...a, [vista]: SEM_AJUSTE })) // foto nova: o ajuste antigo não vale mais
    if (!arquivo && editando === vista) setEditando(null)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (faltas.length || criar.isPending) return
    criar.mutate(
      { nome, comprimento_cm: Number(comprimento), resolucao, fotos, ajustes },
      { onSuccess: (r) => navegar(`/modelos/${r.modelo_id}`) },
    )
  }

  const slot = (vista: Vista) => (
    <UploadSlot
      key={vista}
      vista={vista}
      obrigatoria={OBRIGATORIAS.includes(vista)}
      arquivo={fotos[vista]}
      ajuste={ajustes[vista] ?? SEM_AJUSTE}
      onArquivo={(a) => trocarFoto(vista, a)}
      onAjustar={() => setEditando(vista)}
    />
  )

  return (
    <main className="container novo">
      <h1>Novo modelo</h1>
      <p className="subtitulo">
        Envie as fotos do tênis — <strong>lateral</strong> e <strong>de cima</strong> bastam; a frontal deixa o formato
        melhor. Na dúvida, veja o <Link to="/guia">guia de fotos</Link>.
      </p>

      <form onSubmit={enviar} noValidate>
        <section aria-labelledby="titulo-fotos">
          <h2 id="titulo-fotos">1. Fotos</h2>
          <div className="slots">{VISTAS_PRINCIPAIS.map(slot)}</div>
          <details className="mais-fotos" open={VISTAS_EXTRAS.some((v) => fotos[v])}>
            <summary>Mais fotos (opcional): outro lado, sola e traseira</summary>
            <p className="conceito">
              Com o outro lado e a sola, essas partes ficam com a cor real (sem elas, o outro lado é a lateral espelhada e
              a sola fica cinza). A traseira ajuda a arredondar o calcanhar.
            </p>
            <div className="slots">{VISTAS_EXTRAS.map(slot)}</div>
          </details>
        </section>

        {editando && fotos[editando] && (
          <EditorFoto
            vista={editando}
            arquivo={fotos[editando]!}
            ajuste={ajustes[editando] ?? SEM_AJUSTE}
            onMudar={(a) => setAjustes((s) => ({ ...s, [editando]: a }))}
            onFechar={() => setEditando(null)}
          />
        )}

        <section aria-labelledby="titulo-dados" className="dados">
          <h2 id="titulo-dados">2. Sobre o tênis</h2>
          <div className="campos-form">
            <div className="campo-form">
              <label htmlFor="campo-nome">Nome</label>
              <input id="campo-nome" value={nome} maxLength={80} placeholder="Ex.: Tênis azul de corrida" onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="campo-form">
              <label htmlFor="campo-comprimento">Comprimento real (cm)</label>
              <input
                id="campo-comprimento"
                type="number"
                inputMode="decimal"
                min={5}
                max={60}
                step={0.1}
                placeholder="Ex.: 28,5"
                aria-describedby="dica-comprimento"
                value={comprimento}
                onChange={(e) => setComprimento(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <small id="dica-comprimento">Meça com fita métrica do calcanhar ao bico. O modelo sai exatamente nesse tamanho.</small>
            </div>
          </div>
          <div className="campo-form">
            <span className="rotulo-campo">Qualidade</span>
            <GrupoBotoes
              rotulo="Qualidade"
              valor={qualidade}
              onChange={setQualidade}
              opcoes={QUALIDADES.map((q) => ({ valor: q.id, rotulo: q.rotulo }))}
            />
            <small>{QUALIDADES.find((q) => q.id === qualidade)!.dica}</small>
          </div>
        </section>

        <Painel className="enviar">
          {criar.isError && (
            <p className="erro-envio" role="alert">
              {criar.error.message}
            </p>
          )}
          {faltas.length > 0 && <p className="conceito">Falta {faltas.join(', ')}.</p>}
          <Botao type="submit" variante="primario" grande disabled={faltas.length > 0 || criar.isPending}>
            {criar.isPending ? 'Enviando as fotos…' : 'Gerar modelo 3D'}
          </Botao>
          <p className="conceito">
            Sem IA: o modelo sai do cruzamento das silhuetas das fotos. A abertura do pé fica fechada e o formato visto de
            frente é estimado.
          </p>
        </Painel>
      </form>
    </main>
  )
}
