import { Link } from 'react-router-dom'
import { Botao, Etiqueta, Painel } from '../components/ui'
import { obterToken } from '../lib/api'
import { useConta, useRecarregarCreditos, useSair } from '../lib/consultas'

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
  const autenticado = Boolean(obterToken())
  const conta = useConta()
  const recarregar = useRecarregarCreditos()
  const sair = useSair()

  if (!autenticado) {
    return (
      <main className="container pagina-simples conta-pagina">
        <div className="detalhe-topo">
          <div>
            <h1>Conta e créditos</h1>
            <p className="subtitulo" style={{ marginBottom: 0 }}>
              Você ainda não está conectado a uma conta.
            </p>
          </div>
        </div>

        <div className="conta-auth-grade">
          <Painel className="conta-auth-card">
            <h2>Já tem uma conta?</h2>
            <p className="conceito">
              Entre com seu e-mail e senha para acessar seus modelos 3D salvos e seu saldo de créditos.
            </p>
            <div className="acoes" style={{ marginTop: 16 }}>
              <Botao para="/entrar" variante="secundario">
                Entrar na conta
              </Botao>
            </div>
          </Painel>

          <Painel className="conta-auth-card destaque">
            <h2>Criar nova conta</h2>
            <p className="conceito">
              Cadastre-se para salvar seus próprios modelos. Novas contas ganham automaticamente{' '}
              <strong>10 créditos de boas-vindas</strong> para gerar malhas 3D.
            </p>
            <div className="acoes" style={{ marginTop: 16 }}>
              <Botao para="/cadastrar" variante="primario">
                Criar conta (+10 créditos)
              </Botao>
            </div>
          </Painel>
        </div>

        <p className="conceito" style={{ marginTop: 24, textAlign: 'center' }}>
          Quer apenas testar sem se cadastrar? Você pode enviar fotos direto em <Link to="/novo">Novo modelo</Link> ou
          aprender as fotos ideais no <Link to="/guia">Guia de fotos</Link>.
        </p>
      </main>
    )
  }

  if (conta.isLoading) {
    return (
      <main className="container pagina-simples">
        <p className="conceito">Carregando sua conta…</p>
      </main>
    )
  }

  if (conta.isError) {
    const semServidor =
      conta.error.message.includes('falar com o servidor') ||
      conta.error.message.includes('erro 5') ||
      conta.error.message.includes('offline')
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
          <Botao onClick={sair} variante="fantasma">
            Sair da conta
          </Botao>
          <Botao para="/entrar" variante="secundario">
            Entrar
          </Botao>
          <Botao para="/cadastrar" variante="fantasma">
            Criar conta
          </Botao>
        </div>
      </main>
    )
  }

  const dados = conta.data
  if (!dados) return null

  return (
    <main className="container pagina-simples conta-pagina">
      <div className="detalhe-topo">
        <div>
          <h1>Conta e créditos</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>
            {dados.nome} · <span>{dados.email}</span>
          </p>
        </div>
        <div className="acoes">
          {autenticado ? (
            <Botao onClick={sair} variante="fantasma">
              Sair da conta
            </Botao>
          ) : (
            <>
              <Botao para="/entrar" variante="secundario">
                Entrar
              </Botao>
              <Botao para="/cadastrar" variante="fantasma">
                Criar conta
              </Botao>
            </>
          )}
          <Botao para="/novo" variante="primario">
            Novo modelo
          </Botao>
        </div>
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
