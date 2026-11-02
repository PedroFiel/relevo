import { Link, NavLink, Outlet } from 'react-router-dom'
import { useConta } from '../lib/consultas'
import Logo from './Logo'

const LINKS_PRINCIPAIS = [
  { para: '/', rotulo: 'Início' },
  { para: '/novo', rotulo: 'Novo modelo' },
  { para: '/modelos', rotulo: 'Meus modelos' },
] as const

/** Moldura de todas as páginas: cabeçalho com a navegação principal, saldo de créditos, conteúdo e rodapé. */
export default function AppLayout() {
  const conta = useConta()
  const creditos = conta.data?.creditos

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
            <NavLink
              to="/conta"
              className={`selo-creditos${creditos === 0 ? ' sem-creditos' : ''}`}
              aria-label="Conta e créditos"
            >
              <span className="selo-creditos-ponto" aria-hidden="true" />
              {typeof creditos === 'number'
                ? `${creditos} ${creditos === 1 ? 'crédito' : 'créditos'}`
                : 'Créditos'}
            </NavLink>
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
            <Link to="/conta">Créditos</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
