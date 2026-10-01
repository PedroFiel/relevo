import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type Estado = { falhou: boolean }

/**
 * Evita que um modelo ausente/corrompido derrube a página inteira: mostra o que fazer.
 * Use com `key={url}` para ganhar uma nova chance ao trocar de modelo.
 */
export default class ErroModelo extends Component<Props, Estado> {
  state: Estado = { falhou: false }

  static getDerivedStateFromError(): Estado {
    return { falhou: true }
  }

  render() {
    if (!this.state.falhou) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, color: 'var(--muted)' }}>
        <p><strong style={{ color: 'var(--text)' }}>Não foi possível abrir esse modelo.</strong></p>
        <p>
          Se for o &ldquo;Tênis 01&rdquo;, gere o arquivo com <code>make real</code> e recarregue a
          página. Se for um arquivo seu, confira que é um .glb gerado pelo RELEVO.
        </p>
      </div>
    )
  }
}
