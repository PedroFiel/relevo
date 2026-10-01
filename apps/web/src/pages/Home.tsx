import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="container">
      <h1>RELEVO</h1>
      <p>Três fotos do seu tênis. Um modelo 3D pronto para usar.</p>
      <p>
        <Link to="/visualizador">Abrir modelo de exemplo →</Link>
      </p>
    </main>
  )
}
