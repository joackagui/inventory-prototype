import { useQueries, useQuery } from '@tanstack/react-query'
import { type FiltroAlmacen, useSesion } from '../sesion/Sesion'
import { api } from './cliente'
import type { Alerta, AlertaDetalle, Capa, FilaArticulo, FilaKardex, Pagina, ResumenAlertas, ResumenArticulo, ResumenTablero, Semaforo, SerieStock, StockPreventista, UmbralDetalle, Usuario } from './tipos'

export interface Almacen {
  id: number
  codigo: string
  nombre: string
  nombreLargo: string
  corto: string
}

// Plantas desde GET /api/almacenes (en el orden del seed: LP, CB, SC). Nombre corto para la interfaz: sin "Planta y CD".
export function useAlmacenes() {
  return useQuery({
    queryKey: ['almacenes'],
    queryFn: () => api<{ id: number; codigo: string; nombre: string; tipo: string }[]>('/almacenes'),
    staleTime: Infinity,
    select: (lista): Almacen[] =>
      lista
        .filter((a) => a.tipo === 'PLANTA')
        .sort((a, b) => a.id - b.id)
        .map((a) => ({ id: a.id, codigo: a.codigo, nombreLargo: a.nombre, nombre: a.nombre.replace(/^Planta y CD /, ''), corto: a.codigo.split('-')[1] ?? a.codigo })),
  })
}

export function useNombreAlmacen() {
  const { data } = useAlmacenes()
  return (codigo: string | null | undefined) => (codigo ? (data?.find((a) => a.codigo === codigo)?.nombre ?? codigo) : 'Sistema')
}

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

export function useStockPreventista(codigos: string[]) {
  const { usuario } = useSesion()
  return useQueries({
    queries: codigos.map((c) => ({ queryKey: ['stock', usuario, c], queryFn: () => api<StockPreventista>(`/stock?almacenId=${c}`) })),
  })
}

export function useAlertas(params: string, activo = true) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['alertas', usuario, 'lista', params], queryFn: () => api<Pagina<Alerta>>(`/alertas?${params}`), enabled: activo })
}

export function useResumenAlertasAlmacen(almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['alertas', usuario, 'resumen', almacen], queryFn: () => api<ResumenAlertas>(`/alertas/resumen?${filtro(almacen)}`) })
}

export function useAlertaDetalle(id: number | null) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['alertas', usuario, 'detalle', id], queryFn: () => api<AlertaDetalle>(`/alertas/${id}`), enabled: id !== null })
}

export function useUmbralesDetalle() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['umbrales', usuario], queryFn: () => api<UmbralDetalle[]>('/alertas/umbrales/detalle') })
}

export interface CambioBitacora {
  id: number
  entidad: string
  entidadId: string
  campo: string
  valorAnterior: unknown
  valorNuevo: unknown
  fechaOperacion: string | null
  creadoEn: string
  usuario: { codigo: string } | null
}

export function useBitacora(activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['bitacora', usuario], queryFn: () => api<CambioBitacora[]>('/bitacora'), enabled: activo })
}

export function useEstadoArticulos() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['articulos', usuario, 'estado'], queryFn: () => api<FilaArticulo[]>('/articulos/estado') })
}

export function useResumenArticulo(codigo: string, almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['articulos', usuario, 'resumen', codigo, almacen], queryFn: () => api<ResumenArticulo>(`/articulos/${codigo}/resumen?${filtro(almacen)}`) })
}

export function useCapas(codigo: string, activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['articulos', usuario, 'capas', codigo], queryFn: () => api<Capa[]>(`/articulos/${codigo}/capas`), enabled: activo })
}

export function useKardex(codigo: string, params: string, activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['articulos', usuario, 'kardex', codigo, params], queryFn: () => api<Pagina<FilaKardex>>(`/articulos/${codigo}/kardex?${params}`), enabled: activo, placeholderData: (previo) => previo })
}

export function useSerie(codigo: string, almacen: string, dias: number, activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['articulos', usuario, 'serie', codigo, almacen, dias], queryFn: () => api<SerieStock>(`/articulos/${codigo}/serie?almacenId=${almacen}&dias=${dias}`), enabled: activo })
}

export interface Movimiento {
  id: number
  tipo: string
  cantidad: number
  valor: number
  motivo: string
  fechaOperacion: string
  almacen: { codigo: string }
  usuario: { codigo: string }
}

export function useMovimientosArticulo(codigo: string, almacen: FiltroAlmacen, activo: boolean) {
  const { usuario } = useSesion()
  const extra = almacen === 'TODOS' ? '' : `&almacen=${almacen}`
  return useQuery({ queryKey: ['movimientos', usuario, codigo, almacen], queryFn: () => api<Pagina<Movimiento>>(`/movimientos?articulo=${codigo}&tamano=8${extra}`), enabled: activo })
}
