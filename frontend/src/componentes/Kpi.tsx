import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ColorSemaforo } from '../api/tipos'

const TONO: Record<ColorSemaforo | 'NEUTRO', string> = {
  NEUTRO: 'bg-acento-suave text-acento',
  VERDE: 'bg-verde-fondo text-verde',
  AMARILLO: 'bg-amarillo-fondo text-amarillo',
  ROJO: 'bg-rojo-fondo text-rojo',
  AZUL: 'bg-azul-fondo text-azul',
}

export function Kpi({ titulo, valor, contexto, icono: Icono, tono = 'NEUTRO', className, retraso = 0 }: { titulo: string; valor: string; contexto: string; icono: LucideIcon; tono?: ColorSemaforo | 'NEUTRO'; className?: string; retraso?: number }) {
  return (
    <article className={clsx('entrar flex items-start gap-4 rounded-2xl border border-borde bg-superficie p-5 shadow-tarjeta', className)} style={{ animationDelay: `${retraso}ms` }}>
      <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', TONO[tono])}>
        <Icono aria-hidden className="size-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-suave">{titulo}</h3>
        <p className="num mt-1 truncate text-[1.75rem] leading-tight font-bold tracking-tight" data-kpi={titulo}>
          {valor}
        </p>
        <p className="mt-1 truncate text-sm text-suave">{contexto}</p>
      </div>
    </article>
  )
}
