import clsx from 'clsx'
import { ArrowUpRight } from 'lucide-react'
import type { Alerta } from '../../api/tipos'
import { Semaforo } from '../../componentes/Semaforo'
import { antiguedad, numero } from '../../utils/formato'

export function FilaAlerta({ alerta: a, nombreAlmacen, onAbrir, recienAtendida }: { alerta: Alerta; nombreAlmacen: (c?: string | null) => string; onAbrir: () => void; recienAtendida?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className={clsx('entrar grid w-full grid-cols-[auto_1fr] items-start gap-x-4 gap-y-1 rounded-xl border border-borde bg-superficie p-4 text-left transition hover:-translate-y-px hover:shadow-tarjeta lg:grid-cols-[auto_minmax(16rem,1fr)_2fr_auto]', recienAtendida && 'ring-2 ring-verde')}
        data-testid="fila-alerta"
        data-codigo={a.codigo}
        data-almacen={a.almacen?.codigo ?? ''}
      >
        <span className={clsx('mt-0.5 h-fit rounded-full', a.color === 'ROJO' && a.estado === 'ABIERTA' && 'pulso-rojo')}>
          <Semaforo color={a.color} compacto />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">
            {a.codigo} · {a.nombre}
          </span>
          <span className="block text-sm text-suave">
            {nombreAlmacen(a.almacen?.codigo)}
            {a.articulo ? ` · ${a.articulo.codigo}` : ''}
          </span>
        </span>
        <span className="col-start-2 text-sm lg:col-start-auto">{a.mensaje}</span>
        <span className="col-start-2 flex flex-wrap items-center gap-1.5 text-xs lg:col-start-auto lg:justify-end">
          <span className="rounded-full bg-superficie-2 px-2 py-0.5 font-semibold" title="Rol responsable">
            {a.rolesResponsables.join(' · ')}
          </span>
          <span className="num rounded-full bg-superficie-2 px-2 py-0.5 text-suave">
            {antiguedad(a.antiguedadDias)} · {numero(a.antiguedadDias * 24)} h
          </span>
          {a.nivelEscalamiento > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-marca px-2 py-0.5 font-semibold text-marca-texto">
              <ArrowUpRight aria-hidden className="size-3" /> Nivel {a.nivelEscalamiento}
            </span>
          )}
          <span className={clsx('rounded-full px-2 py-0.5 font-semibold', a.estado === 'ABIERTA' ? 'bg-rojo-fondo text-rojo' : a.estado === 'ATENDIDA' ? 'bg-verde-fondo text-verde' : 'bg-superficie-2 text-suave')}>
            {a.estado === 'ABIERTA' ? 'Sin atender' : a.estado === 'ATENDIDA' ? 'Atendida' : 'Resuelta'}
          </span>
        </span>
      </button>
    </li>
  )
}
