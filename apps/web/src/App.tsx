import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Visualizador from './pages/Visualizador'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/visualizador" element={<Visualizador />} />
    </Routes>
  )
}
