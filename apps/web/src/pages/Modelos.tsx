import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao, Etiqueta } from '../components/ui'
import { obterToken, urlApi, type ModeloResumo } from '../lib/api'
import { useApagarModelo, useModelos } from '../lib/consultas'
import { STATUS } from '../lib/upload'

const data = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "Meus modelos" (F3-T11): cartões com miniatura (a foto lateral), status e data; apagar com confirmação. */
export default function Modelos() {
  const modelos = useModelos()
  const autenticado = Boolean(obterToken())

  return (
    <main className="container largo">
      <div className="detalhe-topo">
        <h1>Meus modelos</h1>
        <Botao para="/novo" variante="primario">Novo modelo</Botao>
      </div>

      {!autenticado && (
        <div className="aviso-banner" style={{ marginBottom: 20 }}>
          <span>Você está no modo visitante (sem conta conectada).</span>
          <span>
            <Link to="/entrar">Entre</Link> ou <Link to="/cadastrar">crie sua conta</Link> para salvar seus modelos 3D com segurança.
          </span>
        </div>
      )}

      {modelos.isPending && <p className="conceito">Carregando…</p>}

      {modelos.isError && (
        <div className="vazio" role="alert">
          <h2>Não foi possível carregar os modelos</h2>
          <p className="erro-envio">{modelos.error.message}</p>
          {(modelos.error.message.includes('servidor') ||
            modelos.error.message.includes('offline') ||
            modelos.error.message.includes('erro 5')) && (
            <p className="conceito">
              Dica: se você rodou apenas <code>make web</code>, o backend na porta 8000 ainda não está ativo.
              Rode <code>make dev</code> (sobe API e front juntos) ou <code>make api</code> em outro terminal.
            </p>
          )}
          <div className="acoes" style={{ marginTop: 16 }}>
            <Botao onClick={() => void modelos.refetch()} variante="primario">
              Tentar novamente
            </Botao>
          </div>
        </div>
      )}

      {modelos.data?.length === 0 && (
        <div className="vazio">
          <h2>Nenhum modelo ainda</h2>
          <p>Envie as fotos de um tênis e o modelo 3D aparece aqui.</p>
          <div className="acoes">
            <Botao para="/novo" variante="primario">Criar o primeiro modelo</Botao>
          </div>
        </div>
      )}
      {modelos.data && modelos.data.length > 0 && (
        <ul className="cartoes">
          {modelos.data.map((m) => (
            <Cartao key={m.id} modelo={m} />
          ))}
        </ul>
      )}
    </main>
  )
}

function Cartao({ modelo }: { modelo: ModeloResumo }) {
  const apagar = useApagarModelo()
  const [confirmando, setConfirmando] = useState(false)
  const s = STATUS[modelo.status]
  return (
    <li className="cartao">
      <Link to={`/modelos/${modelo.id}`} className="cartao-link">
        <div className="cartao-imagem">
          {modelo.miniatura_url ? <img src={urlApi(modelo.miniatura_url)} alt="" loading="lazy" /> : null}
        </div>
        <div className="cartao-corpo">
          <strong>{modelo.nome}</strong>
          <span className="conceito">{data(modelo.atualizado_em)}</span>
        </div>
      </Link>
      <div className="cartao-rodape">
        <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
        {confirmando ? (
          <span className="cartao-confirmar">
            <Botao onClick={() => apagar.mutate(modelo.id)} disabled={apagar.isPending} aria-label={`Confirmar apagar ${modelo.nome}`}>
              {apagar.isPending ? 'Apagando…' : 'Apagar'}
            </Botao>
            <Botao variante="fantasma" onClick={() => setConfirmando(false)}>Cancelar</Botao>
          </span>
        ) : (
          <Botao variante="fantasma" onClick={() => setConfirmando(true)} aria-label={`Apagar ${modelo.nome}`}>
            Apagar
          </Botao>
        )}
      </div>
      {apagar.isError && <p role="alert" className="erro-envio">{apagar.error.message}</p>}
    </li>
  )
}
