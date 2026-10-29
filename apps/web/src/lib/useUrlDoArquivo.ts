import { useEffect, useState } from 'react'

/**
 * URL temporária (`blob:`) para mostrar um arquivo escolhido pelo usuário, liberada quando o
 * arquivo muda ou o componente sai. É criada dentro do efeito (e não em `useMemo`) para continuar
 * válida no StrictMode, que desmonta e monta de novo — o setState aqui sincroniza com um recurso
 * externo, que é o uso previsto de um efeito.
 */
export function useUrlDoArquivo(arquivo: File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!arquivo) {
      // oxlint-disable-next-line react/set-state-in-effect
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(arquivo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [arquivo])
  return url
}
