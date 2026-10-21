import { Hammer } from 'lucide-react'
import type { Seccion } from '../sesion/permisos'

export function Proximamente({ seccion }: { seccion: Seccion }) {
  const Icono = seccion.icono
  return (
    <div className="entrar mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-borde bg-superficie shadow-tarjeta">
      <div className="flex items-center gap-4 bg-marca px-8 py-7 text-marca-texto">
        <span className="grid size-14 place-items-center rounded-2xl bg-marca-2">
          <Icono aria-hidden className="size-7" />
        </span>
        <div>
          <p className="text-sm text-marca-texto-suave">Próximamente</p>
          <h1 className="text-2xl font-bold tracking-tight">{seccion.titulo}</h1>
        </div>
      </div>
      <div className="space-y-3 px-8 py-7">
        <p className="text-lg">{seccion.descripcion}.</p>
        <p className="flex items-center gap-2 text-suave">
          <Hammer aria-hidden className="size-4" /> Esta pantalla llega en una próxima entrega; el backend ya expone sus datos en la API.
        </p>
      </div>
    </div>
  )
}
