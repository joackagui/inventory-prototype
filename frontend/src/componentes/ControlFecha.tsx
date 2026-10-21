import { CalendarDays, RotateCcw } from 'lucide-react'
import { fecha as formatoFecha } from '../utils/formato'

export const FECHA_INICIAL = '2027-06-30'

interface Props {
  fecha: string | null
  puedeCambiar: boolean
  ocupado?: boolean
  onMover: (dias: number) => void
  onFijar: (fecha: string) => void
  onRestablecer: () => void
}

const MOVIMIENTOS = [
  { dias: -1, texto: '−1 día', etiqueta: 'Retroceder 1 día' },
  { dias: 1, texto: '+1 día', etiqueta: 'Avanzar 1 día' },
  { dias: 7, texto: '+7 días', etiqueta: 'Avanzar 7 días' },
  { dias: 30, texto: '+30 días', etiqueta: 'Avanzar 30 días' },
]

// Reloj simulado (presentacional): la fecha de operación de toda la app. Solo R07 y R09 la cambian.
export function ControlFecha({ fecha, puedeCambiar, ocupado = false, onMover, onFijar, onRestablecer }: Props) {
  const boton = 'rounded-lg border border-borde bg-superficie px-2.5 py-1.5 text-sm font-medium hover:bg-superficie-2 disabled:opacity-50'
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fecha simulada">
      <span className="inline-flex items-center gap-2 rounded-xl bg-acento-suave px-3 py-1.5 text-acento" title="Fecha de operación simulada">
        <CalendarDays aria-hidden className="size-4" />
        <span className="sr-only">Fecha simulada:</span>
        <span className="num text-sm font-semibold" data-testid="fecha-simulada">
          {formatoFecha(fecha)}
        </span>
      </span>
      {puedeCambiar && (
        <>
          {MOVIMIENTOS.map((m) => (
            <button key={m.dias} type="button" className={boton} aria-label={m.etiqueta} disabled={ocupado} onClick={() => onMover(m.dias)}>
              {m.texto}
            </button>
          ))}
          <input
            type="date"
            aria-label="Elegir fecha simulada"
            className="num rounded-lg border border-borde bg-superficie px-2 py-1 text-sm"
            value={fecha ?? ''}
            disabled={ocupado}
            onChange={(e) => e.target.value && e.target.value !== fecha && onFijar(e.target.value)}
          />
          <button type="button" className={boton} aria-label={`Restablecer al ${formatoFecha(FECHA_INICIAL)}`} title={`Restablecer al ${formatoFecha(FECHA_INICIAL)}`} disabled={ocupado || fecha === FECHA_INICIAL} onClick={onRestablecer}>
            <RotateCcw aria-hidden className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}
