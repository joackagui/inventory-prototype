import { Moon, Sun } from 'lucide-react'
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
