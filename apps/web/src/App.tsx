import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Fotos from './pages/Fotos'
import Guia from './pages/Guia'
import Home from './pages/Home'
import ModeloDetalhe from './pages/ModeloDetalhe'
import Modelos from './pages/Modelos'
import NaoEncontrada from './pages/NaoEncontrada'
import NovoModelo from './pages/NovoModelo'
import Visualizador from './pages/Visualizador'

/** Rotas finais do MVP (F2-T01). /visualizador e /fotos são o estúdio de CG (demonstração). */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/novo" element={<NovoModelo />} />
        <Route path="/modelos" element={<Modelos />} />
        <Route path="/modelos/:id" element={<ModeloDetalhe />} />
        <Route path="/guia" element={<Guia />} />
        <Route path="/visualizador" element={<Visualizador />} />
        <Route path="/fotos" element={<Fotos />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
