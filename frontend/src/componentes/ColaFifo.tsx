import clsx from 'clsx'
import { ArrowRight, LogIn, LogOut } from 'lucide-react'
import type { Capa } from '../api/tipos'
import { numero } from '../utils/formato'
import { colorVida } from './VidaRestante'

const BORDE = { ROJO: 'border-rojo', AMARILLO: 'border-amarillo', VERDE: 'border-verde' }

// Esquema de la cola FIFO: entra por la izquierda (la más nueva) y sale por la derecha (la más antigua despachable).
export function ColaFifo({ capas }: { capas: Capa[] }) {
  const ordenEntradaSalida = [...capas].reverse()
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1" role="list" aria-label="Cola FIFO, de la entrada a la salida" data-testid="cola-fifo">
      <span className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold text-suave">
        <LogIn aria-hidden className="size-4" /> Entrada
      </span>
      {ordenEntradaSalida.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2" role="listitem">
          {i > 0 && <ArrowRight aria-hidden className="size-4 shrink-0 text-suave" />}
          <div
            className={clsx('min-w-32 rounded-xl border-2 bg-superficie px-3 py-2 text-sm', c.despachable ? BORDE[colorVida(c.vidaRestanteDias)] : 'border-dashed border-borde opacity-80', c.proximaEnSalir && 'ring-2 ring-acento ring-offset-2 ring-offset-superficie')}
            data-capa={c.lote}
            data-proxima={c.proximaEnSalir || undefined}
          >
            <span className="block truncate font-semibold">{c.lote}</span>
            <span className="num block text-lg leading-tight font-bold">{numero(c.cantidadRestante)}</span>
            <span className="num block text-xs text-suave">{numero(c.vidaRestanteDias)} días de vida</span>
            {c.proximaEnSalir && <span className="mt-1 inline-block rounded-full bg-acento px-2 py-0.5 text-[11px] font-bold text-sobre-color">Próxima en salir</span>}
            {!c.despachable && <span className="mt-1 inline-block rounded-full bg-rojo-fondo px-2 py-0.5 text-[11px] font-bold text-rojo">No despachable</span>}
          </div>
        </div>
      ))}
      <ArrowRight aria-hidden className="size-4 shrink-0 self-center text-suave" />
      <span className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold text-suave">
        <LogOut aria-hidden className="size-4" /> Salida
      </span>
    </div>
  )
}
