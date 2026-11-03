/** Hooks TanStack Query sobre o cliente da API (F3-T07). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apagarModelo,
  buscarConta,
  buscarJob,
  buscarModelo,
  buscarModeloPublico,
  criarModelo,
  criarVersao,
  limparToken,
  listarModelos,
  loginUsuario,
  obterToken,
  recarregarCreditos,
  regerarModelo,
  registrarUsuario,
  restaurarVersao,
  salvarToken,
  type Job,
} from './api'
import type { Vista } from './vistas'

export const chaves = {
  modelos: ['modelos'] as const,
  modelo: (id: string) => ['modelos', id] as const,
  publico: (id: string) => ['publico', id] as const,
  job: (id: string) => ['jobs', id] as const,
  conta: ['conta'] as const,
}

/** Job ainda rodando? Enquanto sim, o front consulta de novo a cada segundo (F3-T09). */
export const jobAberto = (job: Pick<Job, 'status'> | null | undefined) =>
  job?.status === 'pendente' || job?.status === 'processando'

export function useModelos() {
  return useQuery({ queryKey: chaves.modelos, queryFn: listarModelos })
}

export function useModelo(id: string) {
  return useQuery({ queryKey: chaves.modelo(id), queryFn: () => buscarModelo(id), retry: false })
}

export function useConta() {
  const token = obterToken()
  return useQuery({
    queryKey: chaves.conta,
    queryFn: buscarConta,
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
}

export function useRecarregarCreditos() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (quantidade?: number) => recarregarCreditos(quantidade),
    onSuccess: (dados) => {
      cliente.setQueryData(chaves.conta, dados)
    },
  })
}

export function useJob(id: string | undefined) {
  const cliente = useQueryClient()
  return useQuery({
    queryKey: chaves.job(id ?? ''),
    queryFn: async () => {
      const job = await buscarJob(id!)
      // Terminou: o detalhe do modelo (status, versão, arquivos) e o saldo (caso estornado) mudaram junto
      if (!jobAberto(job)) {
        await Promise.all([
          cliente.invalidateQueries({ queryKey: chaves.modelos }),
          cliente.invalidateQueries({ queryKey: chaves.conta }),
        ])
      }
      return job
    },
    enabled: Boolean(id),
    refetchInterval: (q) => (jobAberto(q.state.data) || !q.state.data ? 1000 : false),
  })
}

export function useCriarModelo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: criarModelo,
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelos })
      void cliente.invalidateQueries({ queryKey: chaves.conta })
    },
  })
}

export function useCriarVersao(modeloId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (transformacao: number[]) => criarVersao(modeloId, transformacao),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.modelo(modeloId) }),
  })
}

export function useRestaurarVersao(modeloId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (numero: number) => restaurarVersao(modeloId, numero),
    onSuccess: (dados) => {
      cliente.setQueryData(chaves.modelo(modeloId), dados)
      return cliente.invalidateQueries({ queryKey: chaves.modelos })
    },
  })
}

export function useRegerarModelo(modeloId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (mascaras: Partial<Record<Vista, string>>) => regerarModelo(modeloId, mascaras),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelo(modeloId) })
      void cliente.invalidateQueries({ queryKey: chaves.conta })
    },
  })
}

export function useApagarModelo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: apagarModelo,
    onSuccess: (_, id) => {
      cliente.removeQueries({ queryKey: chaves.modelo(id) })
      return cliente.invalidateQueries({ queryKey: chaves.modelos })
    },
  })
}

export function useRegistrar() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: registrarUsuario,
    onSuccess: (resposta) => {
      salvarToken(resposta.access_token)
      cliente.setQueryData(chaves.conta, resposta.usuario)
      void cliente.invalidateQueries({ queryKey: chaves.modelos })
    },
  })
}

export function useLogin() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: loginUsuario,
    onSuccess: (resposta) => {
      salvarToken(resposta.access_token)
      cliente.setQueryData(chaves.conta, resposta.usuario)
      void cliente.invalidateQueries({ queryKey: chaves.modelos })
    },
  })
}

export function useSair() {
  const cliente = useQueryClient()
  return () => {
    limparToken()
    cliente.setQueryData(chaves.conta, null)
    void cliente.invalidateQueries({ queryKey: chaves.conta })
    void cliente.invalidateQueries({ queryKey: chaves.modelos })
  }
}

export function useModeloPublico(id: string) {
  return useQuery({
    queryKey: chaves.publico(id),
    queryFn: () => buscarModeloPublico(id),
    retry: false,
  })
}
