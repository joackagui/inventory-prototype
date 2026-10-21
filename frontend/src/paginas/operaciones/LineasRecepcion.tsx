import clsx from 'clsx'
import { TriangleAlert } from 'lucide-react'
import { campo } from '../../componentes/Formulario'
import { numero } from '../../utils/formato'

export interface LineaRecibida {
  articulo: string
  cantidadRecibida: string
  estado: 'CONFORME' | 'DANADO'
}

// Recepción de un traslado: una línea por artículo con lo esperado, lo recibido y su estado; advierte las diferencias.
export function LineasRecepcion({ esperadas, valor, onCambiar }: { esperadas: { articulo: string; esperada: number }[]; valor: LineaRecibida[]; onCambiar: (v: LineaRecibida[]) => void }) {
  const fijar = (i: number, c: Partial<LineaRecibida>) => onCambiar(valor.map((l, j) => (j === i ? { ...l, ...c } : l)))
  return (
    <ul className="space-y-3" data-testid="lineas-recepcion">
      {esperadas.map((e, i) => {
        const l = valor[i]
        const recibida = Number(l.cantidadRecibida)
        const invalida = l.cantidadRecibida === '' || !Number.isInteger(recibida) || recibida < 0
        const diferencia = invalida ? 0 : e.esperada - recibida
        return (
          <li key={e.articulo} className="rounded-xl bg-superficie-2 p-3" data-articulo={e.articulo}>
            <div className="grid items-end gap-3 sm:grid-cols-4">
              <p className="font-semibold">
                {e.articulo}
                <span className="num block text-sm font-normal text-suave">Esperado: {numero(e.esperada)}</span>
              </p>
              <label className="text-sm">
                Recibido
                <input className={clsx(campo, 'mt-1')} type="number" min={0} max={e.esperada} value={l.cantidadRecibida} onChange={(ev) => fijar(i, { cantidadRecibida: ev.target.value })} aria-label={`Recibido ${e.articulo}`} />
              </label>
              <label className="text-sm">
                Estado
                <select className={clsx(campo, 'mt-1')} value={l.estado} onChange={(ev) => fijar(i, { estado: ev.target.value as LineaRecibida['estado'] })} aria-label={`Estado ${e.articulo}`}>
                  <option value="CONFORME">Bueno</option>
                  <option value="DANADO">Dañado</option>
                </select>
              </label>
            </div>
            {!invalida && recibida > e.esperada && (
              <p className="mt-2 text-sm text-rojo" role="alert">
                No se puede recibir más de lo despachado ({numero(e.esperada)}).
              </p>
            )}
            {!invalida && diferencia > 0 && (
              <p className="mt-2 flex items-start gap-2 text-sm text-amarillo" role="alert" data-testid="aviso-diferencia">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                Diferencia de {numero(diferencia)}: quedará un ajuste PENDIENTE sobre el stock en tránsito para que lo decida R07 (y se creará AL09).
              </p>
            )}
            {l.estado === 'DANADO' && (
              <p className="mt-2 text-sm text-rojo" role="note">
                Lo recibido entra a cuarentena (CUAR-01) y no se vende hasta que R07 lo libere.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export const lineasValidas = (esperadas: { esperada: number }[], valor: LineaRecibida[]) =>
  valor.every((l, i) => l.cantidadRecibida !== '' && Number.isInteger(Number(l.cantidadRecibida)) && Number(l.cantidadRecibida) >= 0 && Number(l.cantidadRecibida) <= esperadas[i].esperada)
