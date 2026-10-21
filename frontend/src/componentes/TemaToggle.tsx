import { Moon, Presentation, Sun } from 'lucide-react'
import { useSesion } from '../sesion/Sesion'

export function TemaToggle() {
  const { tema, alternarTema } = useSesion()
  const oscuro = tema === 'oscuro'
  return (
    <button type="button" onClick={alternarTema} aria-label={oscuro ? 'Usar tema claro' : 'Usar tema oscuro'} title={oscuro ? 'Tema claro' : 'Tema oscuro'} className="grid size-10 place-items-center rounded-xl border border-borde bg-superficie hover:bg-superficie-2">
      {oscuro ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </button>
  )
}

// Modo presentación: letra más grande, más contraste y sin elementos secundarios (para el proyector).
export function PresentacionToggle() {
  const { presentacion, alternarPresentacion } = useSesion()
  return (
    <button
      type="button"
      onClick={alternarPresentacion}
      aria-pressed={presentacion}
      title="Modo presentación"
      className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${presentacion ? 'border-acento bg-acento-suave text-acento' : 'border-borde bg-superficie hover:bg-superficie-2'}`}
    >
      <Presentation aria-hidden className="size-5" />
      <span className="hidden xl:inline">Modo presentación</span>
      <span className="sr-only xl:hidden">Modo presentación</span>
    </button>
  )
}
