import type { UseQueryResult } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { nombreAlmacen } from '../../api/consultas'
import type { Alerta, Pagina } from '../../api/tipos'
import { EstadoError, EstadoVacio } from '../../componentes/Estados'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto } from '../../componentes/Tarjeta'
import { antiguedad } from '../../utils/formato'

export function AlertasAccion({ consulta }: { consulta: UseQueryResult<Pagina<Alerta>> }) {
  if (consulta.isPending) return <Esqueleto className="h-96" />
  if (consulta.isError) return <EstadoError error={consulta.error} reintentar={() => consulta.refetch()} />
  const alertas = consulta.data.datos
  return (
    <div className="flex h-full flex-col">
      {alertas.length ? (
        <ul className="space-y-2.5" data-testid="alertas-accion">
          {alertas.map((a, i) => (
            <li key={a.id} className="entrar flex gap-3 rounded-xl border border-borde p-3" style={{ animationDelay: `${i * 40}ms` }}>
              <span className={clsx('h-fit rounded-full', a.color === 'ROJO' && a.estado === 'ABIERTA' && 'pulso-rojo')}>
                <Semaforo color={a.color} compacto />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="rounded bg-superficie-2 px-1.5 font-bold">{a.codigo}</span>
                  <span className="font-medium">
                    {nombreAlmacen(a.almacen?.codigo)}
                    {a.articulo ? ` · ${a.articulo.codigo}` : ''}
                  </span>
                  <span className="text-suave">· {antiguedad(a.antiguedadDias)}</span>
                  {a.estado === 'ATENDIDA' && <span className="rounded-full bg-verde-fondo px-2 text-xs font-semibold text-verde">Atendida</span>}
                  {a.nivelEscalamiento > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-marca px-2 text-xs font-semibold text-marca-texto">
                      <ArrowUpRight aria-hidden className="size-3" /> Nivel {a.nivelEscalamiento}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{a.mensaje}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio titulo="Nada que atender">No hay alertas vigentes para este filtro.</EstadoVacio>
      )}
      <Link to="/alertas" className="mt-4 inline-flex items-center gap-1.5 self-end text-sm font-semibold text-acento hover:underline">
        Ver las {consulta.data.total} alertas en el centro de alertas <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  )
}
