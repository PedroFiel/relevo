import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErroModelo from './ErroModelo'

function Quebra(): never {
  throw new Error('glb inválido')
}

describe('ErroModelo', () => {
  it('mostra a mensagem de ajuda quando o modelo falha, sem derrubar a página', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErroModelo>
        <Quebra />
      </ErroModelo>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('make reais')
  })

  it('renderiza os filhos quando está tudo certo', () => {
    render(<ErroModelo><p>ok</p></ErroModelo>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
