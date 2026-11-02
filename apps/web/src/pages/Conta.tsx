import { Link } from 'react-router-dom'
import { Botao, Etiqueta, Painel } from '../components/ui'
import { useConta, useRecarregarCreditos } from '../lib/consultas'

const ROTULOS_MOTIVO: Record<string, string> = {
  'boas-vindas': 'Créditos de boas-vindas',
  geracao: 'Geração de modelo 3D',
  'gerar-modelo': 'Geração de modelo 3D',
  regeracao: 'Regeração com máscara corrigida',
  'regerar-mascara': 'Regeração com máscara corrigida',
  estorno: 'Estorno automático por falha no job',
  'estorno-falha': 'Estorno automático por falha no job',
  recarga_demo: 'Recarga de demonstração',
  'recarga-demo': 'Recarga de demonstração',
}

const data = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Conta e créditos (F4-T02): saldo atual de créditos no PostgreSQL, recarga de demonstração
 * e extrato auditável da tabela `movimentos_credito` (débito ao gerar/regerar e estorno se o job falhar).
 */
export default function Conta() {
  const conta = useConta()
  const recarregar = useRecarregarCreditos()

  if (conta.isPending) {
    return (
      <main className="container pagina-simples">
        <p className="conceito">Carregando sua conta…</p>
      </main>
    )
  }

  if (conta.isError) {
    const semServidor = conta.error.message.includes('falar com o servidor') || conta.error.message.includes('erro 5')
    return (
      <main className="container pagina-simples vazio">
        <h1>Não deu para carregar a conta</h1>
        <p role="alert">{conta.error.message}</p>
        {semServidor && (
          <p className="conceito">
            Dica: se você rodou apenas <code>make web</code>, a API na porta 8000 ainda não está ligada. Rode{' '}
            <code>make dev</code> (sobe API + front juntos) ou <code>make api</code> em outro terminal.
          </p>
        )}
        <div className="acoes">
          <Botao onClick={() => void conta.refetch()} variante="primario">
            Tentar novamente
          </Botao>
        </div>
      </main>
    )
  }

  const dados = conta.data

  return (
    <main className="container pagina-simples conta-pagina">
      <div className="detalhe-topo">
        <div>
          <h1>Conta e créditos</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>
            {dados.nome} · <span>{dados.email}</span>
          </p>
        </div>
        <Botao para="/novo" variante="primario">
          Novo modelo
        </Botao>
      </div>

      <Painel className="conta-saldo-painel">
        <div className="conta-saldo-topo">
          <div>
            <span className="conta-saldo-rotulo">Saldo disponível</span>
            <div className="conta-saldo-valor" aria-label="Saldo de créditos">
              <strong>{dados.creditos}</strong>{' '}
              <span>{dados.creditos === 1 ? 'crédito' : 'créditos'}</span>
            </div>
            <p className="conceito">
              Cada geração ou regeração de modelo consome <strong>1 crédito</strong>. Se o processamento falhar, o
              crédito é estornado automaticamente.
            </p>
          </div>
          <div className="acoes">
            <Botao
              onClick={() => recarregar.mutate(10)}
              disabled={recarregar.isPending}
              variante={dados.creditos === 0 ? 'primario' : 'secundario'}
            >
              {recarregar.isPending ? 'Adicionando…' : '+ Adicionar 10 créditos'}
            </Botao>
          </div>
        </div>
        {recarregar.isError && (
          <p role="alert" className="erro-envio">
            {recarregar.error.message}
          </p>
        )}
      </Painel>

      <section aria-labelledby="titulo-movimentos" className="secao-movimentos">
        <h2 id="titulo-movimentos">Histórico de créditos</h2>
        {dados.movimentos.length === 0 ? (
          <p className="conceito">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="guia-tabela tabela-movimentos">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motivo</th>
                  <th>Variação</th>
                </tr>
              </thead>
              <tbody>
                {dados.movimentos.map((m) => (
                  <tr key={m.id}>
                    <td className="leitura">{data(m.criado_em)}</td>
                    <td>
                      {ROTULOS_MOTIVO[m.motivo] ?? m.motivo}
                      {m.job_id && (
                        <span className="conceito" style={{ display: 'block', marginTop: 2 }}>
                          job {m.job_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Etiqueta tom={m.quantidade > 0 ? 'sucesso' : 'aviso'}>
                        {m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade)}
                      </Etiqueta>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="conceito" style={{ marginTop: 16 }}>
          Quer testar com um tênis agora? Vá em <Link to="/novo">Novo modelo</Link> ou veja seus modelos em{' '}
          <Link to="/modelos">Meus modelos</Link>.
        </p>
      </section>
    </main>
  )
}
