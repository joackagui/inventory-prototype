import { useQueries, useQuery } from '@tanstack/react-query'
import { type FiltroAlmacen, useSesion } from '../sesion/Sesion'
import { api } from './cliente'
import type { ClaveConfiguracion, Costos, ConteosAnalisis, Escenario, EventoIntegracion, FilaAbc, Fiesta, ParetoAjustes, Rotacion, UsuarioPermisos, Ajuste, Alerta, AlertaDetalle, Capa, CapaListada, Cliente, ColorAlerta, FilaArticulo, Pedido, Promocion, PropuestaTraslado, SaldoEnvase, StockAlmacen, Traslado, Ubicacion, FilaKardex, Pagina, ResumenAlertas, ResumenArticulo, ResumenTablero, Semaforo, SerieStock, StockPreventista, UmbralDetalle, Usuario } from './tipos'

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

const qs = (params: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]).toString()

export function useClientes() {
  return useQuery({ queryKey: ['clientes'], queryFn: () => api<Cliente[]>('/clientes'), staleTime: Infinity })
}

export function useUbicaciones(almacen: string | undefined) {
  const { usuario } = useSesion()
  return useQuery({
    queryKey: ['ubicaciones', usuario, almacen],
    queryFn: async () => (await api<{ codigo: string; ubicaciones: Ubicacion[] }[]>('/almacenes')).find((a) => a.codigo === almacen)?.ubicaciones ?? [],
    enabled: !!almacen,
    staleTime: Infinity,
  })
}

export function useStock(almacen: string | undefined) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['stock', usuario, almacen], queryFn: () => api<StockAlmacen>(`/stock?almacenId=${almacen}`), enabled: !!almacen })
}

export function usePedidos(almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['pedidos', usuario, almacen], queryFn: () => api<Pedido[]>(`/pedidos?${qs({ almacen: almacen === 'TODOS' ? '' : almacen })}`) })
}

export function useTraslados() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['traslados', usuario], queryFn: () => api<Traslado[]>('/traslados') })
}

export function usePropuesta(almacen: string | undefined) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['traslados', usuario, 'propuesta', almacen], queryFn: () => api<PropuestaTraslado[]>(`/traslados/propuesta?almacenId=${almacen}`), enabled: !!almacen })
}

export function useAjustes(estado?: string) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['ajustes', usuario, estado], queryFn: () => api<Ajuste[]>(`/ajustes?${qs({ estado })}`) })
}

export function useAjusteDetalle(id: number | null) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['ajustes', usuario, 'detalle', id], queryFn: () => api<Ajuste>(`/ajustes/${id}`), enabled: id !== null })
}

export function useImpactoAjuste(p: { almacen?: string; articulo?: string; cantidad?: number; capaId?: number }) {
  const { usuario } = useSesion()
  const activo = !!p.almacen && !!p.articulo && !!p.cantidad
  return useQuery({ queryKey: ['impacto', usuario, p], queryFn: () => api<Ajuste['impacto'] & { faltante?: number }>(`/ajustes/impacto?${qs(p)}`), enabled: activo, retry: false, meta: { silencioso: true } })
}

export function useCapasFiltro(p: { almacen?: string; articulo?: string; estado?: string }, activo = true) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['capas', usuario, p], queryFn: () => api<CapaListada[]>(`/capas?${qs(p)}`), enabled: activo })
}

export function usePromociones() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['promociones', usuario], queryFn: () => api<Promocion[]>('/promociones') })
}

export function useSaldosEnvases(almacen?: string) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['envases', usuario, almacen], queryFn: () => api<SaldoEnvase[]>(`/envases/saldos?${qs({ almacen })}`) })
}

export interface PreviaRecepcion {
  ubicacionSugerida: string
  vidaUtilDias: number
  vencimiento: string | null
  vidaRestanteDias: number | null
  capaAnterior: { lote: string; costoUnitario: number } | null
  variacionPct: number | null
  alertaCosto: { codigo: string; color: ColorAlerta; mensaje: string } | null
}

export function useRecepcionPrevia(p: { almacen?: string; articulo?: string; costoUnitario?: number; fechaElaboracion?: string; lote?: string }) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['recepcion-previa', usuario, p], queryFn: () => api<PreviaRecepcion>(`/operaciones/recepcion/previa?${qs(p)}`), enabled: !!p.almacen && !!p.articulo, retry: false, meta: { silencioso: true } })
}

const almacenQs = (almacen: FiltroAlmacen) => (almacen === 'TODOS' ? '' : almacen)

export function useAbc() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['abc', usuario], queryFn: () => api<FilaAbc[]>('/abc') })
}

export function useParetoAjustes(p: { almacen: FiltroAlmacen; desde?: string; hasta?: string }) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['ajustes', usuario, 'pareto', p], queryFn: () => api<ParetoAjustes>(`/analisis/pareto-ajustes?${qs({ almacenId: almacenQs(p.almacen), desde: p.desde, hasta: p.hasta })}`) })
}

export function useRotacion(almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['rotacion', usuario, almacen], queryFn: () => api<Rotacion>(`/analisis/rotacion?${qs({ almacenId: almacenQs(almacen) })}`) })
}

export function useConteosAnalisis(almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['conteos', usuario, almacen], queryFn: () => api<ConteosAnalisis>(`/analisis/conteos?${qs({ almacenId: almacenQs(almacen) })}`) })
}

export function useFiestas(almacen: FiltroAlmacen) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['fiestas', usuario, almacen], queryFn: () => api<{ fechaOperacion: string; fiestas: Fiesta[] }>(`/fiestas/preparacion?${qs({ almacenId: almacenQs(almacen) })}`) })
}

export function useCostos(almacen: FiltroAlmacen, mes: string | undefined, tasas: Partial<Costos['tasas']> = {}, activo = true) {
  const { usuario } = useSesion()
  return useQuery({
    queryKey: ['costos', usuario, almacen, mes, tasas],
    queryFn: () => api<Costos>(`/costos?${qs({ almacenId: almacenQs(almacen), mes, ...tasas })}`),
    enabled: activo,
    placeholderData: (previo) => previo,
  })
}

export function useConfiguracion() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['configuracion', usuario], queryFn: () => api<ClaveConfiguracion[]>('/configuracion') })
}

export function useEscenarios() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['escenarios', usuario], queryFn: () => api<Escenario[]>('/simulacion/escenarios'), staleTime: Infinity })
}

export function useEventosIntegracion(activo: boolean) {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['integracion', usuario], queryFn: () => api<EventoIntegracion[]>('/integracion/eventos'), enabled: activo })
}

export function usePermisosUsuarios() {
  const { usuario } = useSesion()
  return useQuery({ queryKey: ['permisos', usuario], queryFn: () => api<UsuarioPermisos[]>('/usuarios/permisos') })
}
