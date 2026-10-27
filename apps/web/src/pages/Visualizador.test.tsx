import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Comando, Zoom } from '../lib/visualizador'
import Visualizador from './Visualizador'

// O canvas WebGL não roda no jsdom: o ModelViewer vira um dublê que guarda as props recebidas
type PropsViewer = { zoom?: Zoom; comando?: Comando }
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
