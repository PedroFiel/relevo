import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LIMITES } from '../lib/guiaFotos'
import Home from './Home'

function abrir() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

describe('Home', () => {
  afterEach(cleanup)

  it('o botão principal "Criar modelo" leva para /novo', () => {
    abrir()
    const botoes = screen.getAllByRole('link', { name: 'Criar modelo' })
    expect(botoes.length).toBeGreaterThan(0)
    botoes.forEach((b) => expect(b).toHaveAttribute('href', '/novo'))
    expect(botoes[0]).toHaveClass('botao-primario')
  })

  it('tem o exemplo, os 3 passos e o link para o guia', () => {
    abrir()
    expect(screen.getByRole('link', { name: 'Ver um exemplo' })).toHaveAttribute('href', '/visualizador')
    const passos = screen.getByRole('heading', { name: 'Como funciona' }).parentElement!.querySelectorAll('li')
    expect(passos).toHaveLength(3)
    expect(screen.getByRole('link', { name: /guia de fotos/ })).toHaveAttribute('href', '/guia')
  })

  it('diz que não usa IA e mostra os limites do algoritmo', () => {
    abrir()
    expect(screen.getAllByText(/sem IA|Não usamos inteligência artificial/).length).toBeGreaterThan(0)
    LIMITES.forEach((l) => expect(screen.getByText(l)).toBeInTheDocument())
  })
})
