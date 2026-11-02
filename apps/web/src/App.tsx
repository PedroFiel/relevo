import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Cadastrar from './pages/Cadastrar'
import Conta from './pages/Conta'
import EmbedModelo from './pages/EmbedModelo'
import Entrar from './pages/Entrar'
import Fotos from './pages/Fotos'
import Guia from './pages/Guia'
import Home from './pages/Home'
import ModeloDetalhe from './pages/ModeloDetalhe'
import Modelos from './pages/Modelos'
import NaoEncontrada from './pages/NaoEncontrada'
import NovoModelo from './pages/NovoModelo'
import Visualizador from './pages/Visualizador'

/** Rotas finais do produto (F2-T01, F4-T01, F4-T02, F5-T06). /visualizador e /fotos são o estúdio de CG. */
export default function App() {
  return (
    <Routes>
      <Route path="/embed/:id" element={<EmbedModelo />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/novo" element={<NovoModelo />} />
        <Route path="/modelos" element={<Modelos />} />
        <Route path="/modelos/:id" element={<ModeloDetalhe />} />
        <Route path="/conta" element={<Conta />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/cadastrar" element={<Cadastrar />} />
        <Route path="/guia" element={<Guia />} />
        <Route path="/visualizador" element={<Visualizador />} />
        <Route path="/fotos" element={<Fotos />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
