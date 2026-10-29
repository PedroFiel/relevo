import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { comProvedores, fetchFalso } from '../testes/auxiliares'
import NovoModelo from './NovoModelo'

const jpeg = (nome: string, bytes = 3) => new File([new Uint8Array(bytes)], nome, { type: 'image/jpeg' })

function abrir() {
  comProvedores(
    <Routes>
      <Route path="/novo" element={<NovoModelo />} />
      <Route path="/modelos/:id" element={<p>página do modelo</p>} />
    </Routes>,
    '/novo',
  )
}
const escolher = (rotulo: string, f: File) => fireEvent.change(screen.getByLabelText(rotulo), { target: { files: [f] } })
const gerar = () => screen.getByRole('button', { name: 'Gerar modelo 3D' })

describe('página Novo modelo (F3-T08)', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('"Gerar" fica desabilitado sem lateral e topo e diz o que falta', () => {
    abrir()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Tênis azul' } })
    fireEvent.change(screen.getByLabelText('Comprimento real (cm)'), { target: { value: '28' } })
    expect(gerar()).toBeDisabled()
    expect(screen.getByText(/Falta a foto lateral, a foto de cima/)).toBeInTheDocument()
    escolher('Foto Lateral', jpeg('lateral.jpg'))
    expect(gerar()).toBeDisabled()
    escolher('Foto De cima', jpeg('topo.jpg'))
    expect(gerar()).toBeEnabled()
  })

  it('foto maior que 10 MB mostra o erro e não entra', () => {
    abrir()
    const grande = jpeg('grande.jpg')
    Object.defineProperty(grande, 'size', { value: 11 * 1024 * 1024 })
    escolher('Foto Lateral', grande)
    expect(screen.getByRole('alert')).toHaveTextContent('limite é 10 MB')
    expect(screen.queryByRole('button', { name: 'Ajustar' })).toBeNull()
  })

  it('envia o formulário e abre a página do modelo', async () => {
    const f = fetchFalso({ 'POST /api/modelos': { status: 202, corpo: { modelo_id: 'm1', job_id: 'j1' } } })
    abrir()
    escolher('Foto Lateral', jpeg('lateral.jpg'))
    escolher('Foto De cima', jpeg('topo.jpg'))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Tênis azul' } })
    fireEvent.change(screen.getByLabelText('Comprimento real (cm)'), { target: { value: '28.5' } })
    fireEvent.click(gerar())
    expect(await screen.findByText('página do modelo')).toBeInTheDocument()
    const corpo = f.mock.calls[0][1]!.body as FormData
    expect(corpo.get('comprimento_cm')).toBe('28.5')
    expect(corpo.get('resolucao')).toBeNull() // configuração única: o site não escolhe (ADR 0009)
    expect(corpo.get('topo')).toBeInstanceOf(File)
  })

  it('mostra a mensagem do back quando o envio é recusado', async () => {
    fetchFalso({ 'POST /api/modelos': { status: 400, corpo: { detail: 'A foto lateral não é JPEG nem PNG.' } } })
    abrir()
    escolher('Foto Lateral', jpeg('lateral.jpg'))
    escolher('Foto De cima', jpeg('topo.jpg'))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Comprimento real (cm)'), { target: { value: '28' } })
    fireEvent.click(gerar())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('não é JPEG nem PNG'))
  })
})
