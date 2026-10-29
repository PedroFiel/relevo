/** Hooks TanStack Query sobre o cliente da API (F3-T07). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apagarModelo, buscarJob, buscarModelo, criarModelo, listarModelos, type Job } from './api'

export const chaves = {
  modelos: ['modelos'] as const,
  modelo: (id: string) => ['modelos', id] as const,
  job: (id: string) => ['jobs', id] as const,
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

export function useJob(id: string | undefined) {
  const cliente = useQueryClient()
  return useQuery({
    queryKey: chaves.job(id ?? ''),
    queryFn: async () => {
      const job = await buscarJob(id!)
      // Terminou: o detalhe do modelo (status, versão, arquivos) mudou junto
      if (!jobAberto(job)) await cliente.invalidateQueries({ queryKey: chaves.modelos })
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
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.modelos }),
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
