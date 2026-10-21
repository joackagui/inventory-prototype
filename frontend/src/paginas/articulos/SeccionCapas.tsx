import clsx from 'clsx'
import type { Capa } from '../../api/tipos'
import { ColaFifo } from '../../componentes/ColaFifo'
import { EstadoVacio } from '../../componentes/Estados'
import { VidaRestante } from '../../componentes/VidaRestante'
import { dinero, fecha, numero } from '../../utils/formato'

export function SeccionCapas({ capas, almacenes, vidaUtil }: { capas: Capa[]; almacenes: { codigo: string; nombre: string }[]; vidaUtil: number }) {
  return (
    <div className="space-y-8">
      {almacenes.map((alm) => {
        const propias = capas.filter((c) => c.almacen.codigo === alm.codigo)
        return (
          <section key={alm.codigo} aria-label={`Capas FIFO de ${alm.nombre}`} data-testid={`capas-${alm.codigo}`}>
            <h3 className="mb-3 font-semibold">
              {alm.nombre} <span className="font-normal text-suave">· {propias.length} capas con saldo · {dinero(propias.reduce((s, c) => s + c.valor, 0))}</span>
            </h3>
            {propias.length === 0 ? (
              <EstadoVacio titulo="Sin capas con saldo" />
            ) : (
              <>
                <ColaFifo capas={propias} />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Capas de la más antigua a la más nueva</caption>
                    <thead>
                      <tr className="text-left text-xs font-semibold tracking-wide text-suave uppercase">
                        <th scope="col" className="pb-2">
                          Orden
                        </th>
                        <th scope="col" className="pb-2">
                          Lote
                        </th>
                        <th scope="col" className="pb-2">
                          Ubicación
                        </th>
                        <th scope="col" className="pb-2">
                          Entrada
                        </th>
                        <th scope="col" className="pb-2">
                          Elaboración
                        </th>
                        <th scope="col" className="pb-2">
                          Vencimiento
                        </th>
                        <th scope="col" className="pb-2">
                          Vida restante
                        </th>
                        <th scope="col" className="pb-2 text-right">
                          Inicial
                        </th>
                        <th scope="col" className="pb-2 text-right">
                          Restante
                        </th>
                        <th scope="col" className="pb-2 text-right">
                          Costo
                        </th>
                        <th scope="col" className="pb-2 text-right">
                          Valor
                        </th>
                        <th scope="col" className="pb-2 pl-3">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {propias.map((c, i) => (
                        <tr key={c.id} className={clsx(c.proximaEnSalir && 'bg-acento-suave/60', !c.despachable && 'text-suave')} data-testid="fila-capa" data-lote={c.lote}>
                          <td className="num py-2 font-semibold">{i + 1}</td>
                          <td className="py-2 font-semibold text-texto">{c.lote}</td>
                          <td className="py-2">{c.ubicacion.codigo}</td>
                          <td className="num py-2">{fecha(c.fechaEntrada)}</td>
                          <td className="num py-2">{fecha(c.fechaElaboracion)}</td>
                          <td className="num py-2">{fecha(c.fechaVencimiento)}</td>
                          <td className="py-2">
                            <VidaRestante dias={c.vidaRestanteDias} vidaUtil={vidaUtil} />
                          </td>
                          <td className="num py-2 text-right">{numero(c.cantidadInicial)}</td>
                          <td className="num py-2 text-right font-bold text-texto">{numero(c.cantidadRestante)}</td>
                          <td className="num py-2 text-right" data-costo>
                            {numero(c.costoUnitario, 2)}
                          </td>
                          <td className="num py-2 text-right">{dinero(c.valor)}</td>
                          <td className="py-2 pl-3">
                            {c.proximaEnSalir ? (
                              <span className="rounded-full bg-acento px-2 py-0.5 text-xs font-bold text-sobre-color">Próxima en salir</span>
                            ) : c.despachable ? (
                              <span className="text-xs">En cola</span>
                            ) : (
                              <span className="rounded-full bg-rojo-fondo px-2 py-0.5 text-xs font-bold text-rojo" title={c.motivoNoDespachable ?? ''}>
                                No despachable · {c.motivoNoDespachable}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
