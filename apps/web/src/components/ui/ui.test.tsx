import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Botao, Etiqueta, GrupoBotoes, Painel, Slider } from '.'

describe('componentes base', () => {
  afterEach(cleanup)

  it('Slider chama onChange com o número', () => {
    const onChange = vi.fn()
    render(<Slider rotulo="Resolução" valor={128} min={64} max={192} passo={32} onChange={onChange} formatar={(v) => `${v} voxels`} />)
    const slider = screen.getByLabelText('Resolução')
    expect(screen.getByText('128 voxels')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '160' } })
    expect(onChange).toHaveBeenCalledWith(160)
  })

  it('GrupoBotoes marca a opção ativa e avisa a troca', () => {
    const onChange = vi.fn()
    render(
      <GrupoBotoes
        rotulo="Modo"
        valor="solido"
        onChange={onChange}
        opcoes={[
          { valor: 'solido', rotulo: 'Sólido' },
          { valor: 'arame', rotulo: 'Arame' },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Sólido' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Arame' }))
    expect(onChange).toHaveBeenCalledWith('arame')
  })

  it('Botao vira link com "para" e botão comum sem ele', () => {
    const onClick = vi.fn()
    render(
      <MemoryRouter>
        <Botao para="/novo" variante="primario">
          Ir
        </Botao>
        <Botao onClick={onClick}>Clicar</Botao>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', '/novo')
    const botao = screen.getByRole('button', { name: 'Clicar' })
    expect(botao).toHaveAttribute('type', 'button')
    fireEvent.click(botao)
    expect(onClick).toHaveBeenCalled()
  })

  it('Painel e Etiqueta', () => {
    render(
      <Painel titulo="Métricas">
        <Etiqueta tom="sucesso">fechada</Etiqueta>
      </Painel>,
    )
    expect(screen.getByRole('heading', { name: 'Métricas' })).toBeInTheDocument()
    expect(screen.getByText('fechada')).toHaveClass('etiqueta', 'etiqueta-sucesso')
  })
})
