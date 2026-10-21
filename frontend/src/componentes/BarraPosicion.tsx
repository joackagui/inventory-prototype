import clsx from 'clsx'
import type { ColorSemaforo } from '../api/tipos'
import { numero } from '../utils/formato'
import { SEMAFORO } from './Semaforo'

interface Props {
  disponible: number
  enTransito: number
  reservado: number
  ss: number
  rop: number
  max: number
  color: ColorSemaforo
}

// Bullet chart de posición de stock: disponible + tránsito (= posición) + reservado apilados, con marcas de SS, ROP y Máx.
export function BarraPosicion({ disponible, enTransito, reservado, ss, rop, max, color }: Props) {
  const d = Math.max(0, disponible)
  const escala = Math.max(max * 1.15, d + enTransito + reservado, 1)
  const pct = (v: number) => (v / escala) * 100
  const tramos = [
    { nombre: 'Disponible', valor: d, estilo: { background: SEMAFORO[color].variable } },
    { nombre: 'En tránsito', valor: enTransito, estilo: { background: `repeating-linear-gradient(45deg, ${SEMAFORO[color].variable} 0 4px, transparent 4px 8px)`, opacity: 0.7 } },
    { nombre: 'Reservado', valor: reservado, estilo: { background: 'var(--texto-suave)', opacity: 0.35 } },
  ]
  const marcas = [
    { nombre: 'SS', valor: ss, clase: 'bg-rojo' },
    { nombre: 'ROP', valor: rop, clase: 'bg-amarillo' },
    { nombre: 'Máx', valor: max, clase: 'bg-azul' },
  ]
  return (
    <div role="img" aria-label={`Disponible ${numero(d)}, en tránsito ${numero(enTransito)}, reservado ${numero(reservado)}; SS ${numero(ss)}, ROP ${numero(rop)}, Máx ${numero(max)}`} data-testid="barra-posicion">
      <div className="relative h-7 rounded-lg bg-superficie-2">
        <div className="absolute inset-y-1 left-0 flex w-full overflow-hidden rounded-md">
          {tramos.map((t) => (
            <span key={t.nombre} title={`${t.nombre}: ${numero(t.valor)}`} data-tramo={t.nombre} style={{ width: `${pct(t.valor)}%`, ...t.estilo }} />
          ))}
        </div>
        {marcas.map((m) => (
          <span key={m.nombre} data-marca={m.nombre} title={`${m.nombre}: ${numero(m.valor)}`} className={clsx('absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full', m.clase)} style={{ left: `${pct(m.valor)}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[11px] font-semibold text-suave">
        {marcas.map((m) => (
          <span key={m.nombre} className="num absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(m.valor)}%` }}>
            {m.nombre} {numero(m.valor)}
          </span>
        ))}
      </div>
    </div>
  )
}

// Stock por función (seguridad, ciclo, tránsito, estacional) como barra segmentada.
export function BarraFuncion({ seguridad, ciclo, transito, estacional }: { seguridad: number; ciclo: number; transito: number; estacional: number }) {
  const total = Math.max(seguridad + ciclo + transito + estacional, 1)
  const partes = [
    { nombre: 'Seguridad', valor: seguridad, clase: 'bg-rojo' },
    { nombre: 'Ciclo', valor: ciclo, clase: 'bg-verde' },
    { nombre: 'Tránsito', valor: transito, clase: 'bg-azul' },
    { nombre: 'Estacional (recomendado)', valor: estacional, clase: 'bg-amarillo' },
  ]
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-superficie-2" role="img" aria-label={partes.map((p) => `${p.nombre} ${numero(p.valor)}`).join(', ')}>
        {partes.map((p) => (
          <span key={p.nombre} className={p.clase} style={{ width: `${(p.valor / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        {partes.map((p) => (
          <li key={p.nombre} className="flex items-center gap-1.5">
            <span className={clsx('size-2.5 rounded-sm', p.clase)} aria-hidden />
            {p.nombre} <span className="num font-semibold text-texto">{numero(p.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
