import clsx from 'clsx'
import { CircleCheck, CircleX } from 'lucide-react'
import { ALMACENES, useStockPreventista } from '../../api/consultas'
import { EstadoError } from '../../componentes/Estados'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { numero } from '../../utils/formato'

// Vista del preventista (R01): solo disponible o agotado por almacén, sin costos ni alertas.
export function VistaPreventista() {
  const consultas = useStockPreventista(true)
  const error = consultas.find((c) => c.isError)
  return (
    <div className="space-y-6" data-testid="vista-preventista">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Disponibilidad para preventa</h1>
        <p className="mt-1 text-suave">Stock vendible hoy por almacén (descuenta reservas y lotes con menos de 15 días de vida).</p>
      </div>
      <Tarjeta>
        {error ? (
          <EstadoError error={error.error} reintentar={() => consultas.forEach((c) => c.refetch())} />
        ) : consultas.some((c) => c.isPending) ? (
          <Esqueleto className="h-80" />
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Disponibilidad por artículo y almacén</caption>
            <thead>
              <tr className="text-xs font-semibold tracking-wide text-suave uppercase">
                <th scope="col" className="pb-3">
                  Artículo
                </th>
                {ALMACENES.map((a) => (
                  <th key={a.codigo} scope="col" className="pb-3">
                    {a.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {consultas[0].data!.articulos.map((art) => (
                <tr key={art.codigo}>
                  <th scope="row" className="py-3 font-normal">
                    <span className="num block font-semibold">{art.codigo}</span>
                    <span className="text-sm text-suave">{art.descripcion}</span>
                  </th>
                  {consultas.map((c, i) => {
                    const fila = c.data!.articulos.find((x) => x.codigo === art.codigo)!
                    const hay = fila.estado === 'DISPONIBLE'
                    const Icono = hay ? CircleCheck : CircleX
                    return (
                      <td key={ALMACENES[i].codigo} className="py-3">
                        <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold', hay ? 'bg-verde-fondo text-verde' : 'bg-rojo-fondo text-rojo')}>
                          <Icono aria-hidden className="size-4" />
                          {hay ? 'Disponible' : 'Agotado'}
                          {hay && <span className="num font-medium">({numero(fila.disponible)})</span>}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </div>
  )
}
