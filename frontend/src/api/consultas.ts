import { useQueries, useQuery } from '@tanstack/react-query'
import { type FiltroAlmacen, useSesion } from '../sesion/Sesion'
import { api } from './cliente'
import type { Alerta, Pagina, ResumenAlertas, ResumenTablero, Semaforo, StockPreventista, Usuario } from './tipos'

export const ALMACENES = [
  { codigo: 'CD-LP-01', nombre: 'La Paz', corto: 'LP' },
  { codigo: 'CD-CB-01', nombre: 'Cochabamba', corto: 'CB' },
  { codigo: 'CD-SC-01', nombre: 'Santa Cruz', corto: 'SC' },
] as const

export const nombreAlmacen = (codigo: string | null | undefined) => ALMACENES.find((a) => a.codigo === codigo)?.nombre ?? codigo ?? 'Sistema'

// Todas las claves llevan el usuario: al cambiarlo, cada pantalla vuelve a pedir sus datos con sus permisos.
export function useUsuarios() {
  return useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/usuarios'), staleTime: Infinity })
}

export function useUsuarioActual() {
  const { usuario } = useSesion()
  const { data, isPending } = useUsuarios()
  const actual = data?.find((u) => u.codigo === usuario)
  return { usuario: actual, rol: actual?.rolCodigo, cargando: isPending }
}

export function useFecha() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['fecha', usuario], queryFn: () => api<{ fechaSimulada: string | null }>('/simulacion/fecha') })
}

const filtro = (almacen: FiltroAlmacen) => (almacen === 'TODOS' ? '' : `almacenId=${almacen}`)

export function useTablero(almacen: FiltroAlmacen, activo = true) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['tablero', usuario, almacen], queryFn: () => api<ResumenTablero>(`/tablero/resumen?${filtro(almacen)}`), enabled: activo })
}

export function useSemaforos(codigos: string[], activo = true) {
  const { usuario } = useSesion()
  return useQueries({
    queries: codigos.map((c) => ({ queryKey: ['semaforo', usuario, c], queryFn: () => api<Semaforo>(`/semaforo?almacenId=${c}`), enabled: activo })),
  })
}

export function useAlertasAccion(almacen: FiltroAlmacen, activo = true) {
  const { usuario } = useSesion()
  const extra = almacen === 'TODOS' ? '' : `&almacen=${almacen}`
  return useQuery({ queryKey: ['alertas', usuario, 'accion', almacen], queryFn: () => api<Pagina<Alerta>>(`/alertas?orden=gravedad&tamano=6${extra}`), enabled: activo })
}

export function useAlertasCelda(almacen: string, articulo: string, activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({
    queryKey: ['alertas', usuario, 'celda', almacen, articulo],
    queryFn: () => api<Pagina<Alerta>>(`/alertas?orden=gravedad&almacen=${almacen}&articulo=${articulo}`),
    enabled: activo,
  })
}

export function useResumenAlertas(activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['alertas', usuario, 'resumen'], queryFn: () => api<ResumenAlertas>('/alertas/resumen'), enabled: activo })
}

export function useStockPreventista(activo: boolean) {
  const { usuario } = useSesion()
  return useQueries({
    queries: ALMACENES.map((a) => ({ queryKey: ['stock', usuario, a.codigo], queryFn: () => api<StockPreventista>(`/stock?almacenId=${a.codigo}`), enabled: activo })),
  })
}
