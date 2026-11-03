import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Comando, Zoom } from '../lib/visualizador'
import Visualizador from './Visualizador'

// O canvas WebGL não roda no jsdom: o ModelViewer vira um dublê que guarda as props recebidas
type PropsViewer = { zoom?: Zoom; comando?: Comando; formato?: string; url?: string }
const viewer = vi.hoisted(() => ({ props: {} as PropsViewer }))
vi.mock('../components/ModelViewer', () => ({
  default: (p: PropsViewer) => {
    viewer.props = p
    return <div data-testid="viewer" />
  },
}))

function abrir() {
  render(
    <MemoryRouter>
      <Visualizador />
    </MemoryRouter>,
  )
}

describe('estúdio e upload de arquivos 3D (.glb, .obj, .stl)', () => {
  afterEach(cleanup)

  it('permite carregar arquivo .obj e passa formato="obj" ao ModelViewer', () => {
    abrir()
    const input = screen.getByLabelText(/Abrir 3D/i) as HTMLInputElement
    const arquivoObj = new File(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'], 'tenis-exportado.obj', {
      type: 'model/obj',
    })

    fireEvent.change(input, { target: { files: [arquivoObj] } })

    expect(screen.getByRole('button', { name: /OBJ tenis-exportado\.obj/i })).toBeInTheDocument()
    expect(viewer.props.formato).toBe('obj')
  })

  it('permite carregar arquivo .stl e passa formato="stl" ao ModelViewer', () => {
    abrir()
    const input = screen.getByLabelText(/Abrir 3D/i) as HTMLInputElement
    const arquivoStl = new File(['solid test...'], 'modelo-3d.stl', {
      type: 'model/stl',
    })

    fireEvent.change(input, { target: { files: [arquivoStl] } })

    expect(screen.getByRole('button', { name: /STL modelo-3d\.stl/i })).toBeInTheDocument()
    expect(viewer.props.formato).toBe('stl')
  })

  it('recusa arquivo de imagem ou formato não 3D e avisa o usuário', () => {
    abrir()
    const input = screen.getByLabelText(/Abrir 3D/i) as HTMLInputElement
    const arquivoInvalido = new File(['fake data'], 'foto.png', {
      type: 'image/png',
    })

    fireEvent.change(input, { target: { files: [arquivoInvalido] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/Esse formato não é suportado/i)
  })
})

describe('aba Ampliar do visualizador', () => {
  afterEach(cleanup)

  it('só tem o zoom que aproxima a câmera (sem modo lente/FOV)', () => {
    abrir()
    expect(screen.queryByRole('button', { name: /Lente/ })).toBeNull()
    expect(screen.queryByRole('slider', { name: /FOV/ })).toBeNull()
  })

  it('o checkbox "no ponto" chega ao canvas', () => {
    abrir()
    expect(viewer.props.zoom).toEqual({ noPonto: true })
    fireEvent.click(screen.getByLabelText(/amplia no ponto sob o cursor/))
    expect(viewer.props.zoom).toEqual({ noPonto: false })
  })

  it('＋ Ampliar pede ao canvas para aproximar (fator < 1)', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: '＋ Ampliar' }))
    expect(viewer.props.comando).toMatchObject({ tipo: 'ampliar', fator: 0.7 })
  })
})
