import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, CirclePlus, Flag, Palette, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api/cliente'
import { useAlertaDetalle, useNombreAlmacen, useUsuarioActual } from '../../api/consultas'
import type { AlertaDetalle } from '../../api/tipos'
import { EstadoError } from '../../componentes/Estados'
import { Medidor } from '../../componentes/Medidor'
import { PanelLateral } from '../../componentes/PanelLateral'
import { SEMAFORO, Semaforo } from '../../componentes/Semaforo'
import { Esqueleto } from '../../componentes/Tarjeta'
import { antiguedad, fecha, numero } from '../../utils/formato'

export const RESULTADOS = ['Traslado emitido', 'Conteo programado o realizado', 'Ajuste revisado', 'Lote en liquidación o cuarentena', 'Cliente contactado', 'Pedido reprogramado', 'Escalado por correo', 'Sin acción: condición esperada', 'Otro']

// Etiquetas legibles para los datos de apoyo de cada alerta.
const ETIQUETAS: Record<string, string> = {
  posicion: 'Posición',
  rop: 'ROP',
  ss: 'SS',
  trasladoPropuesto: 'Traslado propuesto',
  vendible: 'Vendible',
  disponible: 'Disponible',
  maximo: 'Máx',
  vidaRestanteDias: 'Vida restante (días)',
  lote: 'Lote',
  cantidad: 'Cantidad',
  diasDesdeConteo: 'Días desde el último conteo',
  clase: 'Clase ABC',
  porcentaje: 'Diferencia (%)',
  diferencia: 'Diferencia',
  sistema: 'Cantidad en sistema',
  horas: 'Horas',
  motivo: 'Motivo',
  diasEnTransito: 'Días en tránsito',
  leadTimeDias: 'Lead time L (días)',
  numero: 'Documento',
  despachada: 'Despachado',
  danado: 'Producto dañado',
  dias: 'Días',
  pendiente: 'Envases pendientes',
  cliente: 'Cliente',
  costoNuevo: 'Costo nuevo',
  costoAnterior: 'Costo capa anterior',
  variacionPct: 'Variación (%)',
  diasParaFiesta: 'Días para la fiesta',
  pronostico: 'Pronóstico de la fiesta',
  fiesta: 'Fiesta',
  demandaDiaria: 'Demanda diaria d',
  diasRestantes: 'Días restantes',
  promocion: 'Promoción',
  coberturaDias: 'Cobertura (días)',
  estado: 'Estado',
  tipo: 'Tipo',
  referencia: 'Referencia',
  intentos: 'Intentos',
}

const valorLegible = (v: unknown) => (typeof v === 'number' ? numero(v, Number.isInteger(v) ? 0 : 2) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))

// Enlace al registro que origina la alerta.
function origen(a: AlertaDetalle): { texto: string; ruta: string } | null {
  const q = (accion: string) => `/operaciones?accion=${accion}&id=${a.referenciaId}${a.articulo ? `&articulo=${a.articulo.codigo}` : ''}${a.almacen ? `&almacen=${a.almacen.codigo}` : ''}`
  switch (a.referenciaTipo) {
    case 'OrdenTraslado':
      return { texto: 'Ver traslado', ruta: q('traslado') }
    case 'AjusteInventario':
      return { texto: 'Ver ajuste', ruta: `/aprobaciones?ajuste=${a.referenciaId}` }
    case 'PedidoSimulado':
      return { texto: 'Ver pedido', ruta: q('pedido') }
    case 'Cliente':
      return { texto: 'Ver envases del cliente', ruta: q('envases') }
    case 'EventoIntegracion':
      return { texto: 'Ver evento de integración', ruta: `/administracion?evento=${a.referenciaId}` }
    case 'Fiesta':
      return { texto: 'Ver preparación de fiestas', ruta: `/fiestas?fiesta=${a.referenciaId}` }
    default:
      return null
  }
}

const ICONO_HISTORIAL = { CREADA: CirclePlus, CAMBIO_COLOR: Palette, ESCALADA: TrendingUp, ATENDIDA: Flag, RESUELTA: CircleCheck }
const TITULO_HISTORIAL = { CREADA: 'Creada', CAMBIO_COLOR: 'Cambio de color', ESCALADA: 'Escalada', ATENDIDA: 'Atendida', RESUELTA: 'Resuelta' }

// ¿Puede el usuario atenderla? Misma regla que el backend: un rol responsable (R06 solo en su almacén) o R07.
export function motivoNoAtender(a: Pick<AlertaDetalle, 'estado' | 'rolesResponsables' | 'almacen'>, rol?: string, almacenUsuario?: string | null): string | null {
  if (a.estado !== 'ABIERTA') return a.estado === 'ATENDIDA' ? 'Ya fue atendida.' : 'La alerta ya se resolvió.'
  if (rol === 'R07') return null
  if (!rol || !a.rolesResponsables.includes(rol)) return `Solo la atiende ${[...new Set([...a.rolesResponsables, 'R07'])].join(' o ')}.`
  if (rol === 'R06' && a.almacen?.codigo !== almacenUsuario) return 'Solo puedes atender alertas de tu almacén.'
  return null
}

export function PanelAlerta({ id, onCerrar, onAtendida }: { id: number | null; onCerrar: () => void; onAtendida: (id: number) => void }) {
  const consulta = useAlertaDetalle(id)
  const { usuario, rol } = useUsuarioActual()
  const nombreAlmacen = useNombreAlmacen()
  const [resultado, setResultado] = useState(RESULTADOS[0])
  const [comentario, setComentario] = useState('')
  const atender = useMutation({
    mutationFn: () => api(`/alertas/${id}/atender`, { metodo: 'POST', cuerpo: { resultado, comentario: comentario || undefined } }),
    onSuccess: () => {
      toast.success('Alerta atendida', { description: 'Seguirá visible mientras la condición se mantenga.' })
      setComentario('')
      onAtendida(id!)
    },
  })
  if (id === null) return null
  const a = consulta.data
  const destino = a && origen(a)
  const bloqueo = a ? motivoNoAtender(a, rol, usuario?.almacen?.codigo) : null
  return (
    <PanelLateral abierto onCerrar={onCerrar} titulo={a ? `${a.codigo} · ${a.nombre}` : 'Alerta'} descripcion={a ? `${nombreAlmacen(a.almacen?.codigo)}${a.articulo ? ` · ${a.articulo.codigo}` : ''} · ${antiguedad(a.antiguedadDias)}` : undefined}>
      {consulta.isPending ? (
        <Esqueleto className="h-96" />
      ) : consulta.isError ? (
        <EstadoError error={consulta.error} reintentar={() => consulta.refetch()} />
      ) : (
        a && (
          <div className="space-y-6" data-testid="panel-alerta">
            <div className="flex flex-wrap items-center gap-2">
              <Semaforo color={a.color} />
              <span className="rounded-full bg-superficie-2 px-2.5 py-1 text-sm font-semibold">{a.situacion}</span>
              {a.nivelEscalamiento > 0 && <span className="rounded-full bg-marca px-2.5 py-1 text-sm font-semibold text-marca-texto">Escalada · nivel {a.nivelEscalamiento}</span>}
            </div>
            <p className="text-lg font-medium">{a.mensaje}</p>
            {a.medicion && <Medidor medicion={a.medicion} />}
            <section className="rounded-xl border-l-4 border-acento bg-acento-suave p-4">
              <h3 className="text-sm font-semibold text-acento">Acción sugerida · {a.rolesResponsables.join(', ')}</h3>
              <p className="mt-1">{a.accionSugerida}</p>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Datos de apoyo</h3>
              <dl className="grid grid-cols-2 gap-2">
                {Object.entries(a.datos).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-superficie-2 px-3 py-2">
                    <dt className="text-xs text-suave">{ETIQUETAS[k] ?? k}</dt>
                    <dd className="num font-semibold">{valorLegible(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="flex flex-wrap gap-2">
              {a.articulo && (
                <Link to={`/articulos/${a.articulo.codigo}`} className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-marca-texto hover:bg-marca-2">
                  Ver artículo <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
              {destino && (
                <Link to={destino.ruta} className="inline-flex items-center gap-1.5 rounded-lg border border-borde px-3 py-2 text-sm font-semibold hover:bg-superficie-2">
                  {destino.texto} <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </div>
            <section>
              <h3 className="mb-3 font-semibold">Historial</h3>
              <ol className="relative space-y-4 border-l-2 border-borde pl-6" aria-label="Historial de la alerta">
                {a.historial.map((h) => {
                  const Icono = ICONO_HISTORIAL[h.tipo]
                  return (
                    <li key={h.id} className="relative">
                      <span className="absolute top-0.5 -left-[2.1rem] grid size-7 place-items-center rounded-full border-2 border-borde bg-superficie">
                        <Icono aria-hidden className="size-3.5" />
                      </span>
                      <p className="text-sm font-semibold">
                        {TITULO_HISTORIAL[h.tipo]}
                        {h.tipo === 'CAMBIO_COLOR' && h.colorAnterior && h.colorNuevo && ` · ${SEMAFORO[h.colorAnterior].texto} → ${SEMAFORO[h.colorNuevo].texto}`}
                        {h.tipo === 'ESCALADA' && ` · nivel ${h.nivel}`}
                        <span className="num ml-2 font-normal text-suave">{fecha(h.fechaOperacion)}</span>
                      </p>
                      {h.detalle && <p className="text-sm text-suave">{h.detalle}</p>}
                      {h.usuario && <p className="text-xs text-suave">por {h.usuario.codigo}</p>}
                    </li>
                  )
                })}
              </ol>
            </section>
            {a.estado === 'ATENDIDA' && (
              <p className="rounded-xl bg-verde-fondo p-4 text-sm text-verde">
                Atendida por <b>{a.atendidaPor?.codigo}</b> el {fecha(a.fechaAtencion)}: {a.resultado}
                {a.comentario ? ` — ${a.comentario}` : ''}
              </p>
            )}
            {a.estado === 'ABIERTA' && (
              <form
                className="space-y-3 rounded-xl border border-borde p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  atender.mutate()
                }}
                aria-label="Atender alerta"
              >
                <h3 className="font-semibold">Atender</h3>
                <label className="block text-sm">
                  <span className="text-suave">Resultado</span>
                  <select className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2" value={resultado} onChange={(e) => setResultado(e.target.value)} disabled={!!bloqueo}>
                    {RESULTADOS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-suave">Comentario (opcional)</span>
                  <textarea className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={!!bloqueo} />
                </label>
                {bloqueo && (
                  <p className="text-sm text-amarillo" role="note">
                    {bloqueo}
                  </p>
                )}
                <button type="submit" disabled={!!bloqueo || atender.isPending} className="w-full rounded-xl bg-marca px-4 py-2.5 font-semibold text-marca-texto hover:bg-marca-2 disabled:cursor-not-allowed disabled:opacity-50">
                  {atender.isPending ? 'Guardando…' : 'Atender alerta'}
                </button>
              </form>
            )}
          </div>
        )
      )}
    </PanelLateral>
  )
}
