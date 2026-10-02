import { Route, Routes } from 'react-router-dom'
import Fotos from './pages/Fotos'
import Home from './pages/Home'
import Visualizador from './pages/Visualizador'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/visualizador" element={<Visualizador />} />
      <Route path="/fotos" element={<Fotos />} />
    </Routes>
  )
}
