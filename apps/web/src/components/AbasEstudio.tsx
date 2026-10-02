import { NavLink } from 'react-router-dom'

/** As duas metades do estúdio: o MODELO 3D (saída) e as FOTOS 2D (entrada do pipeline). */
export default function AbasEstudio() {
  return (
    <nav className="abas-estudio" aria-label="Estúdio">
      <NavLink to="/visualizador">Modelo 3D</NavLink>
      <NavLink to="/fotos">Fotos 2D (entrada)</NavLink>
    </nav>
  )
}
