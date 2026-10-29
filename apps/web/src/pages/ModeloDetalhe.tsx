import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EtapasJob from '../components/EtapasJob'
import FotosDoModelo from '../components/FotosDoModelo'
import { Botao, Etiqueta, GrupoBotoes, Painel } from '../components/ui'
import { urlApi, type ModeloDetalhe as Detalhe } from '../lib/api'
import { jobAberto, useApagarModelo, useJob, useModelo } from '../lib/consultas'
import { STATUS } from '../lib/upload'
import Visualizador from './Visualizador'

const tamanho = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`

/** Página do modelo: andamento (F3-T09), modelo 3D com as ferramentas de CG (F3-T10) e fotos com contorno (F3-T14). */
export default function ModeloDetalhe() {
  const { id = '' } = useParams()
  const modelo = useModelo(id)
  const dados = modelo.data
  const job = useJob(dados && jobAberto(dados.job) ? dados.job!.id : undefined)
  const { refetch } = modelo
  // Quando o job termina, busca o detalhe de novo (status, versão, arquivo)
  const terminou = job.data && !jobAberto(job.data)
  useEffect(() => {
    if (terminou) void refetch()
  }, [terminou, refetch])

  if (modelo.isPending) return <main className="container"><p className="conceito">Carregando o modelo…</p></main>
  if (modelo.isError) {
    return (
      <main className="container pagina-simples vazio">
        <h1>{modelo.error.message.includes('não encontrado') ? 'Modelo não encontrado' : 'Não deu para abrir o modelo'}</h1>
        <p>{modelo.error.message}</p>
        <div className="acoes">
          <Botao para="/modelos" variante="primario">Ver meus modelos</Botao>
        </div>
      </main>
    )
  }
  return <Conteudo dados={dados!} jobAoVivo={job.data} />
}

function Conteudo({ dados, jobAoVivo }: { dados: Detalhe; jobAoVivo?: Detalhe['job'] }) {
  const [aba, setAba] = useState<'modelo' | 'fotos'>('modelo')
  const navegar = useNavigate()
  const apagar = useApagarModelo()
  const [confirmando, setConfirmando] = useState(false)
  const job = jobAoVivo ?? dados.job
  const processando = jobAberto(job)
  const status = processando ? 'processando' : dados.status
  const glb = dados.versao?.arquivos.find((a) => a.tipo === 'glb')
  const m = dados.versao?.metricas
  const tempo = m?.tempos_s ? Object.values(m.tempos_s).reduce((a, b) => a + b, 0) : null

  return (
    <main className="container largo detalhe">
      <div className="detalhe-topo">
        <div>
          <p className="conceito"><Link to="/modelos">← Meus modelos</Link></p>
          <h1>{dados.nome}</h1>
          <div className="selos">
            <Etiqueta tom={STATUS[status].tom}>{STATUS[status].rotulo}</Etiqueta>
            <Etiqueta>{dados.comprimento_cm.toLocaleString('pt-BR')} cm</Etiqueta>
            {dados.versao && <Etiqueta>versão {dados.versao.numero}</Etiqueta>}
          </div>
        </div>
        <div className="acoes">
          {glb && (
            <a className="botao botao-primario" href={urlApi(glb.url)} download={`${dados.nome}.glb`}>
              Baixar .glb ({tamanho(glb.tamanho_bytes)})
            </a>
          )}
          {confirmando ? (
            <>
              <Botao
                onClick={() => apagar.mutate(dados.id, { onSuccess: () => navegar('/modelos') })}
                disabled={apagar.isPending}
              >
                {apagar.isPending ? 'Apagando…' : 'Sim, apagar'}
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(false)}>Cancelar</Botao>
            </>
          ) : (
            <Botao variante="fantasma" onClick={() => setConfirmando(true)}>Apagar</Botao>
          )}
        </div>
      </div>
      {apagar.isError && <p role="alert" className="erro-envio">{apagar.error.message}</p>}
      {confirmando && !apagar.isError && (
        <p className="conceito">Apagar remove o modelo, as fotos e os arquivos para sempre.</p>
      )}

      {processando && job && (
        <Painel titulo="Gerando o seu modelo 3D" className="andamento">
          <EtapasJob job={job} />
          <p className="conceito">Pode deixar esta página aberta: ela atualiza sozinha.</p>
        </Painel>
      )}

      {!processando && status === 'erro' && (
        <Painel titulo="Não conseguimos gerar o modelo" className="falha">
          <p role="alert">{job?.erro ?? 'O processamento falhou.'}</p>
          {job && <EtapasJob job={job} />}
          <div className="acoes">
            <Botao para="/novo" variante="primario">Tentar com outras fotos</Botao>
            <Botao para="/guia">Ver o guia de fotos</Botao>
          </div>
        </Painel>
      )}

      {!processando && dados.status === 'pronto' && glb && (
        <>
          <div className="metricas-resumo">
            {m && <Etiqueta tom={m.fechada ? 'sucesso' : 'erro'}>{m.fechada ? 'malha fechada' : 'malha aberta'}</Etiqueta>}
            {m && <span>{m.faces.toLocaleString('pt-BR')} faces</span>}
            {m && <span>{m.dimensoes_cm.map((v) => v.toLocaleString('pt-BR')).join(' × ')} cm (C × A × L)</span>}
            {tempo !== null && <span>gerado em {tempo.toFixed(1).replace('.', ',')} s</span>}
            {m?.avisos?.length ? <Etiqueta tom="aviso">{m.avisos.length} aviso{m.avisos.length > 1 ? 's' : ''}</Etiqueta> : null}
          </div>
          <GrupoBotoes
            rotulo="Ver"
            valor={aba}
            onChange={setAba}
            opcoes={[
              { valor: 'modelo', rotulo: 'Modelo 3D' },
              { valor: 'fotos', rotulo: `Fotos e contornos (${dados.imagens.length})` },
            ]}
          />
          <div className="aba-conteudo">
            {aba === 'modelo' ? (
              <Visualizador key={glb.id} urlFixa={urlApi(glb.url)} />
            ) : (
              <FotosDoModelo imagens={dados.imagens} metricas={m ?? null} />
            )}
          </div>
        </>
      )}
    </main>
  )
}
