import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { nombreAlmacen, useAlertasCelda } from '../../api/consultas'
import type { FilaSemaforo } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { PanelLateral } from '../../componentes/PanelLateral'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto } from '../../componentes/Tarjeta'
import { antiguedad, numero } from '../../utils/formato'

export function PanelDetalle({ seleccion, onCerrar }: { seleccion: { almacen: string; fila: FilaSemaforo } | null; onCerrar: () => void }) {
  const navegar = useNavigate()
  const alertas = useAlertasCelda(seleccion?.almacen ?? '', seleccion?.fila.codigo ?? '', !!seleccion)
  if (!seleccion) return null
  const { fila, almacen } = seleccion
  const datos: [string, string][] = [
    ['Disponible', numero(fila.disponible)],
    ['Vendible', numero(Math.max(0, fila.vendible))],
    ['Reservado', numero(fila.reservado)],
    ['En tránsito', numero(fila.enTransito)],
    ['Posición', numero(fila.posicion)],
    ['Cobertura', `${numero(fila.coberturaDias, 1)} días`],
    ['SS', numero(fila.stockSeguridad)],
    ['ROP', numero(fila.rop)],
    ['Máx', numero(fila.stockMaximo)],
    ['Vida restante', fila.vidaRestanteDias == null ? '—' : `${numero(fila.vidaRestanteDias)} días`],
    ['Traslado propuesto', numero(fila.trasladoPropuesto)],
    ['Clase ABC', fila.claseAbc],
  ]
  return (
    <PanelLateral abierto onCerrar={onCerrar} titulo={`${fila.codigo} · ${nombreAlmacen(almacen)}`} descripcion={fila.descripcion}>
      <div className="space-y-6">
        <Semaforo color={fila.color} />
        <dl className="grid grid-cols-3 gap-3">
          {datos.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-superficie-2 p-3">
              <dt className="text-xs font-medium text-suave">{k}</dt>
              <dd className="num mt-0.5 text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <section>
          <h3 className="mb-2 font-semibold">Alertas vigentes</h3>
          {alertas.isPending ? (
            <Esqueleto className="h-24" />
          ) : alertas.data?.datos.length ? (
            <ul className="space-y-2">
              {alertas.data.datos.map((a) => (
                <li key={a.id} className="rounded-xl border border-borde p-3">
                  <div className="flex items-center gap-2">
                    <Semaforo color={a.color} compacto />
                    <span className="font-semibold">{a.codigo}</span>
                    <span className="text-xs text-suave">· {antiguedad(a.antiguedadDias)} · {a.situacion}</span>
                  </div>
                  <p className="mt-1 text-sm">{a.mensaje}</p>
                  <p className="mt-1 text-xs text-suave">Acción: {a.accionSugerida}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVacio titulo="Sin alertas vigentes">Este artículo está en condición normal en este almacén.</EstadoVacio>
          )}
        </section>
        <button onClick={() => navegar(`/articulos/${fila.codigo}`)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-marca px-4 py-2.5 font-semibold text-marca-texto hover:bg-marca-2">
          Ver artículo <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </PanelLateral>
  )
}
