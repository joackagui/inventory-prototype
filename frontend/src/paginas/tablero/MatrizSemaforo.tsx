import clsx from 'clsx'
import { nombreAlmacen } from '../../api/consultas'
import type { FilaSemaforo, Semaforo as DatosSemaforo } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { SEMAFORO, Semaforo } from '../../componentes/Semaforo'
import { Esqueleto } from '../../componentes/Tarjeta'
import { numero } from '../../utils/formato'

const FONDO = { VERDE: 'border-l-verde', AMARILLO: 'border-l-amarillo', ROJO: 'border-l-rojo', AZUL: 'border-l-azul' } as const

export function MatrizSemaforo({ semaforos, cargando, onSeleccionar }: { semaforos: (DatosSemaforo | undefined)[]; cargando: boolean; onSeleccionar: (almacen: string, fila: FilaSemaforo) => void }) {
  if (cargando) return <Esqueleto className="h-96" />
  const columnas = semaforos.filter((s): s is DatosSemaforo => !!s)
  if (!columnas.length) return <EstadoVacio titulo="Sin datos de semáforo" />
  const articulos = columnas[0].articulos
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1.5">
        <caption className="sr-only">Semáforo por artículo (filas) y almacén (columnas)</caption>
        <thead>
          <tr className="text-left text-xs font-semibold tracking-wide text-suave uppercase">
            <th scope="col" className="px-2 pb-1">
              Artículo
            </th>
            {columnas.map((c) => (
              <th key={c.almacen} scope="col" className="px-2 pb-1">
                {nombreAlmacen(c.almacen)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {articulos.map((art) => (
            <tr key={art.codigo}>
              <th scope="row" className="max-w-56 px-2 text-left align-middle font-normal">
                <span className="flex items-center gap-2">
                  <span className="num font-semibold">{art.codigo}</span>
                  <span className="rounded bg-superficie-2 px-1.5 text-xs font-bold text-suave" title={`Clase ${art.claseAbc}`}>
                    {art.claseAbc}
                  </span>
                </span>
                <span className="block truncate text-xs text-suave">{art.descripcion}</span>
              </th>
              {columnas.map((c) => {
                const fila = c.articulos.find((x) => x.codigo === art.codigo)!
                return (
                  <td key={c.almacen} className="px-1">
                    <button
                      type="button"
                      onClick={() => onSeleccionar(c.almacen, fila)}
                      aria-label={`${fila.codigo} en ${c.almacen}: ${SEMAFORO[fila.color].texto}, disponible ${numero(fila.disponible)}${fila.alertas.length ? `, alertas ${fila.alertas.join(' ')}` : ', sin alertas'}`}
                      className={clsx('flex w-full min-w-36 items-center gap-3 rounded-xl border border-l-4 border-borde bg-superficie-2 px-3 py-2 text-left transition hover:-translate-y-px hover:shadow-tarjeta', FONDO[fila.color])}
                      data-testid={`celda-${c.almacen}-${fila.codigo}`}
                    >
                      <Semaforo color={fila.color} compacto />
                      <span className="min-w-0 flex-1">
                        <span className="num block text-lg leading-tight font-bold">{numero(fila.disponible)}</span>
                        <span className="block truncate text-xs font-medium text-suave">{fila.alertas.length ? fila.alertas.join(' ') : 'Sin alertas'}</span>
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
