import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ListaAvisos from './ListaAvisos'

describe('ListaAvisos (F3-T14)', () => {
  afterEach(cleanup)

  it('sem avisos diz que não houve problema', () => {
    render(<ListaAvisos avisos={[]} />)
    expect(screen.getByText('Nenhum problema nas fotos.')).toBeInTheDocument()
  })

  it('lista cada aviso', () => {
    render(<ListaAvisos avisos={['Giramos a foto de topo em 90°.', 'A foto frontal parece ter perspectiva.']} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
