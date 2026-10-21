import clsx from 'clsx'
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ColorSemaforo } from '../api/tipos'

export const SEMAFORO: Record<ColorSemaforo, { texto: string; icono: LucideIcon; clase: string; variable: string }> = {
  VERDE: { texto: 'Normal', icono: CircleCheck, clase: 'text-verde bg-verde-fondo', variable: 'var(--verde)' },
  AMARILLO: { texto: 'Atención', icono: TriangleAlert, clase: 'text-amarillo bg-amarillo-fondo', variable: 'var(--amarillo)' },
  ROJO: { texto: 'Crítico', icono: OctagonAlert, clase: 'text-rojo bg-rojo-fondo', variable: 'var(--rojo)' },
  AZUL: { texto: 'Informativo', icono: Info, clase: 'text-azul bg-azul-fondo', variable: 'var(--azul)' },
}

// Semáforo accesible: siempre ícono + texto (en modo compacto el texto queda para lectores de pantalla y en el title).
export function Semaforo({ color, compacto = false, className }: { color: ColorSemaforo; compacto?: boolean; className?: string }) {
  const { texto, icono: Icono, clase } = SEMAFORO[color]
  return (
    <span title={texto} className={clsx('inline-flex items-center gap-1.5 rounded-full font-semibold', clase, compacto ? 'p-1' : 'px-2.5 py-1 text-sm', className)}>
      <Icono aria-hidden className={compacto ? 'size-4' : 'size-4'} strokeWidth={2.25} />
      <span className={compacto ? 'sr-only' : undefined}>{texto}</span>
    </span>
  )
}
