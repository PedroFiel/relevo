import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useConta, useSair } from '../lib/consultas'
import Logo from './Logo'

const LINKS_PRINCIPAIS = [
  { para: '/', rotulo: 'Início' },
  { para: '/novo', rotulo: 'Novo modelo' },
  { para: '/modelos', rotulo: 'Meus modelos' },
] as const

/** Moldura de todas as páginas: cabeçalho com a navegação principal, autenticação, créditos, conteúdo e rodapé. */
export default function AppLayout() {
  const conta = useConta()
  const sair = useSair()
  const navegar = useNavigate()
  const usuario = conta.data
  const creditos = usuario?.creditos
  const primeiroNome = usuario?.nome ? usuario.nome.split(' ')[0] : null

  function aoSair() {
    sair()
    navegar('/')
  }

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="cabecalho-interno">
          <Link to="/" className="logo" aria-label="RELEVO — início">
            <Logo />
            RELEVO
          </Link>
          <div className="cabecalho-direita">
            <nav className="nav-principal" aria-label="Principal">
              {LINKS_PRINCIPAIS.map((l) => (
                <NavLink key={l.para} to={l.para} end={l.para === '/'}>
                  {l.rotulo}
                </NavLink>
              ))}
            </nav>
            <div className="cabecalho-auth">
              {usuario ? (
                <>
                  <NavLink
                    to="/conta"
                    className={`selo-creditos${creditos === 0 ? ' sem-creditos' : ''}`}
                    aria-label="Conta e créditos"
                    title={`Saldo: ${creditos ?? 0} créditos`}
                  >
                    <span className="selo-creditos-ponto" aria-hidden="true" />
                    {typeof creditos === 'number'
                      ? `${creditos} ${creditos === 1 ? 'crédito' : 'créditos'}`
                      : 'Créditos'}
                  </NavLink>
                  <NavLink
                    to="/conta"
                    className="link-usuario"
                    aria-label="Minha conta"
                    title={usuario.email}
                  >
                    <span className="avatar-letra" aria-hidden="true">
                      {primeiroNome ? primeiroNome[0].toUpperCase() : 'U'}
                    </span>
                    <span className="usuario-nome">{primeiroNome}</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={aoSair}
                    className="btn-sair"
                    aria-label="Sair da conta"
                    title="Sair da conta"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <div className="acoes-auth-topo">
                  <NavLink to="/entrar" className="btn-link-auth">
                    Entrar
                  </NavLink>
                  <NavLink to="/cadastrar" className="btn-cadastrar-topo">
                    Criar conta
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="app-conteudo">
        <Outlet />
      </div>
      <footer className="rodape">
        <div className="container">
          <span>RELEVO — fotos viram modelos 3D, sem IA.</span>
          <span>
            <Link to="/guia">Guia de fotos</Link> · <Link to="/visualizador">Estúdio de CG</Link> ·{' '}
            <Link to="/conta">Conta e créditos</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
