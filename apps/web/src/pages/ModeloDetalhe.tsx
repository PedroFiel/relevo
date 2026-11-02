import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EtapasJob from '../components/EtapasJob'
import FotosDoModelo from '../components/FotosDoModelo'
import RaioX from '../components/RaioX'
import { Botao, Etiqueta, GrupoBotoes, Painel } from '../components/ui'
import { urlApi, urlExportarVersao, type ModeloDetalhe as Detalhe } from '../lib/api'
import {
  jobAberto,
  useApagarModelo,
  useCriarVersao,
  useJob,
  useModelo,
  useRegerarModelo,
  useRestaurarVersao,
} from '../lib/consultas'
import { STATUS } from '../lib/upload'
import Visualizador from './Visualizador'

const tamanho = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`

/**
 * Página do modelo: andamento (F3-T09), modelo 3D com as ferramentas de CG (F3-T10), fotos com contorno e pincel (F3-T14, F5-T05),
 * versões transformadas (F4-T03, F4-T04), exportação multi-formato .glb/.obj/.stl (F4-T05) e o Raio-X do pipeline (F5-T01).
 */
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
  const [aba, setAba] = useState<'modelo' | 'fotos' | 'raio-x'>('modelo')
  const navegar = useNavigate()
  const apagar = useApagarModelo()
  const criarVersao = useCriarVersao(dados.id)
  const restaurarVersao = useRestaurarVersao(dados.id)
  const regerar = useRegerarModelo(dados.id)
  const [confirmando, setConfirmando] = useState(false)
  const [mostrandoEmbed, setMostrandoEmbed] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const job = jobAoVivo ?? dados.job
  const processando = jobAberto(job)
  const status = processando ? 'processando' : dados.status
  const versao = dados.versao
  const glb = versao?.arquivos.find((a) => a.tipo === 'glb')
  const m = versao?.metricas
  const tempo = m?.tempos_s ? Object.values(m.tempos_s).reduce((a, b) => a + b, 0) : null
  const versoes = dados.versoes ?? []
  const origemEmbed = typeof window !== 'undefined' ? window.location.origin : ''
  const codigoIframe = `<iframe src="${origemEmbed}/embed/${dados.id}" width="600" height="400" style="border:0;border-radius:12px" title="${dados.nome} — RELEVO 3D" loading="lazy"></iframe>`

  function copiarIframe() {
    void navigator.clipboard?.writeText(codigoIframe)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <main className="container largo detalhe">
      <div className="detalhe-topo">
        <div>
          <p className="conceito"><Link to="/modelos">← Meus modelos</Link></p>
          <h1>{dados.nome}</h1>
          <div className="selos">
            <Etiqueta tom={STATUS[status].tom}>{STATUS[status].rotulo}</Etiqueta>
            <Etiqueta>{dados.comprimento_cm.toLocaleString('pt-BR')} cm</Etiqueta>
            {versao && <Etiqueta>versão {versao.numero}</Etiqueta>}
          </div>
          {versoes.length > 1 && versao && (
            <div className="versoes-barra" role="group" aria-label="Histórico de versões">
              <span className="conceito">Versões:</span>
              {versoes.map((v) => {
                const ativa = v.numero === versao.numero
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="versao-pilula"
                    aria-pressed={ativa}
                    disabled={ativa || restaurarVersao.isPending}
                    onClick={() => restaurarVersao.mutate(v.numero)}
                  >
                    v{v.numero}
                    {v.transformacao && ' · 4×4'}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="acoes">
          {glb && versao && versao.id && (
            <>
              <a className="botao botao-primario" href={urlApi(glb.url)} download={`${dados.nome}.glb`}>
                Baixar .glb ({tamanho(glb.tamanho_bytes)})
              </a>
              <a className="botao" href={urlExportarVersao(versao.id, 'obj')} download={`${dados.nome}.obj`}>
                Baixar .obj
              </a>
              <a className="botao" href={urlExportarVersao(versao.id, 'stl')} download={`${dados.nome}.stl`}>
                Baixar .stl
              </a>
              <Botao variante="secundario" onClick={() => setMostrandoEmbed((v) => !v)}>
                {mostrandoEmbed ? 'Fechar incorporar' : 'Incorporar (<iframe>)'}
              </Botao>
            </>
          )}
          {glb && (!versao || !versao.id) && (
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
      {restaurarVersao.isError && <p role="alert" className="erro-envio">{restaurarVersao.error.message}</p>}
      {confirmando && !apagar.isError && (
        <p className="conceito">Apagar remove o modelo, as fotos e os arquivos para sempre.</p>
      )}
      {mostrandoEmbed && (
        <Painel titulo="Incorporar em outro site ou loja virtual (F5-T06)" className="embed-painel">
          <p className="conceito">
            Cole este código HTML em qualquer página de e-commerce para exibir o modelo 3D interativo:
          </p>
          <pre className="matriz" aria-label="Código HTML do iframe">{codigoIframe}</pre>
          <div className="acoes">
            <Botao onClick={copiarIframe} variante="primario">
              {copiado ? 'Código copiado!' : 'Copiar código HTML'}
            </Botao>
            <a className="botao" href={`/embed/${dados.id}`} target="_blank" rel="noreferrer">
              Abrir visualização incorporada ↗
            </a>
          </div>
        </Painel>
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
              { valor: 'raio-x', rotulo: 'Raio-X do pipeline' },
            ]}
          />
          <div className="aba-conteudo">
            {aba === 'modelo' && (
              <Visualizador
                key={glb.id}
                urlFixa={urlApi(glb.url)}
                aoSalvarVersao={(matriz) => criarVersao.mutate(matriz)}
                salvandoVersao={criarVersao.isPending}
                erroVersao={criarVersao.isError ? criarVersao.error.message : undefined}
              />
            )}
            {aba === 'fotos' && (
              <FotosDoModelo
                imagens={dados.imagens}
                metricas={m ?? null}
                regerando={regerar.isPending}
                erroRegerar={regerar.isError ? regerar.error.message : undefined}
                aoRegerarMascara={(vista, png) =>
                  regerar.mutate({ [vista]: png }, { onSuccess: () => setAba('modelo') })
                }
              />
            )}
            {aba === 'raio-x' && versao && <RaioX imagens={dados.imagens} versao={versao} />}
          </div>
        </>
      )}
    </main>
  )
}
