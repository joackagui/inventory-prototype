import clsx from 'clsx'
import { CircleCheck, CircleDot, Clock } from 'lucide-react'
import type { EstadoHito, Hito } from '../api/tipos'
import { fecha } from '../utils/formato'

const ESTADO: Record<EstadoHito, { texto: string; icono: typeof Clock; clase: string }> = {
  PASADO: { texto: 'Hecho', icono: CircleCheck, clase: 'text-verde bg-verde-fondo' },
  EN_CURSO: { texto: 'En curso', icono: CircleDot, clase: 'text-acento bg-acento-suave' },
  PROXIMO: { texto: 'Próximo', icono: Clock, clase: 'text-suave bg-superficie-2' },
}

// Hitos de preparación de una fiesta: estado (con ícono y texto), fecha objetivo, responsables y acción.
export function Cronograma({ hitos }: { hitos: Hito[] }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-borde pl-6" aria-label="Cronograma de preparación" data-testid="cronograma">
      {hitos.map((h) => {
        const { texto, icono: Icono, clase } = ESTADO[h.estado]
        return (
          <li key={h.clave} className="relative" data-hito={h.clave} data-estado={h.estado}>
            <span className={clsx('absolute top-0.5 -left-[2.15rem] grid size-7 place-items-center rounded-full ring-4 ring-superficie', clase)}>
              <Icono aria-hidden className="size-4" />
            </span>
            <div className={clsx('rounded-xl border p-3', h.estado === 'EN_CURSO' ? 'border-acento' : 'border-borde')}>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <b>{h.titulo}</b>
                <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', clase)}>{texto}</span>
                <span className="num text-suave">
                  {fecha(h.desde)}
                  {h.hasta !== h.desde && ` – ${fecha(h.hasta)}`}
                </span>
                <span className="ml-auto rounded bg-marca px-1.5 text-xs font-bold text-marca-texto">{h.responsables.join(' · ')}</span>
              </p>
              <p className="mt-1 text-sm text-suave">{h.accion}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
