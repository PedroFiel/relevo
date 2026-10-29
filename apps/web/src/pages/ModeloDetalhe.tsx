import { useParams } from 'react-router-dom'
import EmConstrucao from '../components/EmConstrucao'

export default function ModeloDetalhe() {
  const { id } = useParams()
  return (
    <EmConstrucao titulo="Modelo">
      A página do modelo <code>{id}</code> vai mostrar o andamento do processamento e, quando ficar pronto, o tênis em
      3D com as ferramentas e o botão de download.
    </EmConstrucao>
  )
}
