import { CircleAlert, Inbox, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { describirError } from '../api/cliente'

export function EstadoVacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-superficie-2 text-suave">
        <Inbox aria-hidden className="size-6" />
      </span>
      <p className="font-medium">{titulo}</p>
      {children && <p className="max-w-sm text-sm text-suave">{children}</p>}
    </div>
  )
}

export function EstadoError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-rojo-fondo text-rojo">
        <CircleAlert aria-hidden className="size-6" />
      </span>
      <p className="font-medium">No se pudieron cargar los datos</p>
      <p className="max-w-md text-sm text-suave">{describirError(error)}</p>
      {reintentar && (
        <button onClick={reintentar} className="inline-flex items-center gap-2 rounded-lg border border-borde px-3 py-1.5 text-sm font-medium hover:bg-superficie-2">
          <RotateCw aria-hidden className="size-4" /> Reintentar
        </button>
      )}
    </div>
  )
}
