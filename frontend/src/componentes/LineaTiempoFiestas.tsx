import clsx from 'clsx'
import type { EstadoFiesta, Fiesta } from '../api/tipos'
import { fecha as formatoFecha } from '../utils/formato'

const MS_DIA = 86_400_000
const t = (s: string) => new Date(`${s}T00:00:00Z`).getTime()
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const ESTADO_FIESTA: Record<EstadoFiesta, { texto: string; barra: string; chip: string }> = {
  OK: { texto: 'Preparada', barra: 'bg-verde', chip: 'bg-verde-fondo text-verde' },
  EN_RIESGO: { texto: 'En riesgo', barra: 'bg-amarillo', chip: 'bg-amarillo-fondo text-amarillo' },
  CRITICO: { texto: 'Crítica', barra: 'bg-rojo', chip: 'bg-rojo-fondo text-rojo' },
  PASADA: { texto: 'Pasada', barra: 'bg-borde', chip: 'bg-superficie-2 text-suave' },
}

interface Props {
  fiestas: Pick<Fiesta, 'id' | 'nombre' | 'fechaInicio' | 'fechaFin' | 'ventanaDesde' | 'estado'>[]
  fecha: string
  desde?: string
  hasta?: string
  seleccionada?: number | null
  onElegir: (id: number) => void
}

// Línea de tiempo anual: una fila por fiesta con su ventana de preparación sombreada, la fiesta coloreada por estado
// y un marcador vertical en la fecha simulada. Las posiciones son porcentajes del rango.
export function LineaTiempoFiestas({ fiestas, fecha, desde = '2027-01-01', hasta = '2028-01-31', seleccionada, onElegir }: Props) {
  const total = t(hasta) + MS_DIA - t(desde)
  const pos = (s: string) => Math.min(100, Math.max(0, ((t(s) - t(desde)) / total) * 100))
  const ancho = (a: string, b: string) => Math.max(0.6, pos(b) + (MS_DIA / total) * 100 - pos(a))
  const meses = Array.from({ length: 13 }, (_, i) => `${2027 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`)
  return (
    <div className="relative" data-testid="linea-tiempo">
      <div className="relative ml-56 h-6 text-xs text-suave" aria-hidden>
        {meses.map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pos(m)}%` }}>
            {MESES[Number(m.slice(5, 7)) - 1]}
            {m.startsWith('2028') && ' 28'}
          </span>
        ))}
      </div>
      <ul className="relative space-y-1.5">
        <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-acento" style={{ left: `calc(14rem + (100% - 14rem) * ${pos(fecha) / 100})` }} data-testid="marcador-fecha" data-pos={pos(fecha).toFixed(2)}>
          <span className="absolute -top-6 -translate-x-1/2 rounded bg-acento px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">{formatoFecha(fecha)}</span>
        </span>
        {fiestas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onElegir(f.id)}
              aria-pressed={seleccionada === f.id}
              aria-label={`${f.nombre}: ${formatoFecha(f.fechaInicio)} a ${formatoFecha(f.fechaFin)}, ${ESTADO_FIESTA[f.estado].texto}`}
              className={clsx('grid w-full grid-cols-[14rem_1fr] items-center rounded-lg text-left text-sm hover:bg-superficie-2', seleccionada === f.id && 'bg-acento-suave')}
              data-fiesta={f.nombre}
            >
              <span className="truncate px-2 py-1.5 font-medium">{f.nombre}</span>
              <span className="relative h-6">
                <span className="absolute inset-y-1 rounded bg-acento-suave" style={{ left: `${pos(f.ventanaDesde)}%`, width: `${ancho(f.ventanaDesde, f.fechaInicio)}%` }} data-tramo="ventana" />
                <span className={clsx('absolute inset-y-0 rounded', ESTADO_FIESTA[f.estado].barra)} style={{ left: `${pos(f.fechaInicio)}%`, width: `${ancho(f.fechaInicio, f.fechaFin)}%` }} data-tramo="fiesta" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="mt-3 ml-56 flex flex-wrap gap-4 text-xs text-suave" aria-label="Leyenda">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-acento-suave" aria-hidden /> Ventana de preparación
        </li>
        {(Object.keys(ESTADO_FIESTA) as EstadoFiesta[]).map((e) => (
          <li key={e} className="flex items-center gap-1.5">
            <span className={clsx('h-3 w-5 rounded', ESTADO_FIESTA[e].barra)} aria-hidden /> {ESTADO_FIESTA[e].texto}
          </li>
        ))}
      </ul>
    </div>
  )
}
