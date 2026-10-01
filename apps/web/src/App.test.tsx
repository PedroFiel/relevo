import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { MODOS } from './lib/modosRender'

describe('App', () => {
  it('renderiza a página inicial', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'RELEVO' })).toBeInTheDocument()
  })

  it('tem os 3 modos de visualização da Fase 0', () => {
    expect(MODOS.map((m) => m.id)).toEqual(['solido', 'wireframe', 'normais'])
  })
})
