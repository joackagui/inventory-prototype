import clsx from 'clsx'
import type { Medicion } from '../api/tipos'
import { decimal, numero } from '../utils/formato'

// Zona en la que cae el valor según los umbrales (misma regla que el backend: ≤ o > según el sentido).
export function zonaDe(m: Medicion): 'ROJO' | 'AMARILLO' | 'AZUL' | 'VERDE' {
  const peor = (umbral: number) => (m.menorEsPeor ? m.valor <= umbral : m.valor > umbral)
  if (peor(m.rojo)) return 'ROJO'
  if (m.amarillo !== null && peor(m.amarillo)) return m.nivelBajoEsAzul ? 'AZUL' : 'AMARILLO'
  return 'VERDE'
}

const TEXTO = { ROJO: 'zona roja', AMARILLO: 'zona amarilla', AZUL: 'zona azul (informativa)', VERDE: 'zona normal' }
const MARCA = { ROJO: 'bg-rojo', AMARILLO: 'bg-amarillo', AZUL: 'bg-azul', VERDE: 'bg-verde' }

// Medidor horizontal: valor medido frente a los umbrales amarillo y rojo de la alerta.
export function Medidor({ medicion: m }: { medicion: Medicion }) {
  const tope = Math.max(m.valor, m.rojo, m.amarillo ?? 0, 1) * 1.25
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / tope) * 100))}%`
  const zona = zonaDe(m)
  const amarillo = m.amarillo ?? m.rojo
  // Tramos de color de izquierda a derecha según el sentido de la alerta.
  const tramos = m.menorEsPeor
    ? [
        { desde: 0, hasta: m.rojo, clase: 'bg-rojo-fondo' },
        { desde: m.rojo, hasta: amarillo, clase: m.nivelBajoEsAzul ? 'bg-azul-fondo' : 'bg-amarillo-fondo' },
        { desde: amarillo, hasta: tope, clase: 'bg-verde-fondo' },
      ]
    : [
        { desde: 0, hasta: amarillo, clase: 'bg-verde-fondo' },
        { desde: amarillo, hasta: m.rojo, clase: m.nivelBajoEsAzul ? 'bg-azul-fondo' : 'bg-amarillo-fondo' },
        { desde: m.rojo, hasta: tope, clase: 'bg-rojo-fondo' },
      ]
  const descripcion = `${m.etiqueta}: ${numero(m.valor, m.unidad === '%' ? 2 : 0)} ${m.unidad}, en ${TEXTO[zona]}. ${m.amarillo !== null ? `${m.nivelBajoEsAzul ? 'Azul' : 'Amarillo'} ${m.menorEsPeor ? '≤' : '>'} ${decimal(m.amarillo)}, ` : ''}rojo ${m.menorEsPeor ? '≤' : '>'} ${decimal(m.rojo)}.`
  return (
    <figure className="space-y-2" aria-label={descripcion} role="img" data-testid="medidor">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-suave">{m.etiqueta}</span>
        <span className="num text-2xl font-bold">
          {numero(m.valor, m.unidad === '%' ? 2 : 0)} <span className="text-base font-semibold text-suave">{m.unidad}</span>
        </span>
      </figcaption>
      <div className="relative h-4 overflow-hidden rounded-full bg-superficie-2">
        {tramos.map((t, i) => (
          <span key={i} className={clsx('absolute inset-y-0', t.clase)} style={{ left: pos(t.desde), width: `calc(${pos(t.hasta)} - ${pos(t.desde)})` }} />
        ))}
        <span className={clsx('absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full ring-2 ring-superficie', MARCA[zona])} style={{ left: pos(m.valor) }} />
      </div>
      <div className="relative h-5 text-xs text-suave">
        {m.amarillo !== null && (
          <span className="num absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(m.amarillo) }}>
            {m.nivelBajoEsAzul ? 'azul' : 'amarillo'} {decimal(m.amarillo)}
          </span>
        )}
        <span className="num absolute -translate-x-1/2 whitespace-nowrap font-semibold text-rojo" style={{ left: pos(m.rojo) }}>
          rojo {decimal(m.rojo)}
        </span>
      </div>
      <p className="sr-only">{descripcion}</p>
    </figure>
  )
}
