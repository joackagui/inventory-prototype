import clsx from 'clsx'
import { numero } from '../utils/formato'

// Vida restante de una capa: verde > 30 días, amarillo 15–30, rojo < 15 (mismos cortes que AL04 y el despacho).
export function colorVida(dias: number) {
  return dias < 15 ? 'ROJO' : dias <= 30 ? 'AMARILLO' : 'VERDE'
}

const CLASE = { ROJO: 'bg-rojo', AMARILLO: 'bg-amarillo', VERDE: 'bg-verde' }
const TEXTO = { ROJO: 'text-rojo', AMARILLO: 'text-amarillo', VERDE: 'text-verde' }

export function VidaRestante({ dias, vidaUtil }: { dias: number; vidaUtil: number }) {
  const color = colorVida(dias)
  const ancho = Math.min(100, Math.max(2, (dias / vidaUtil) * 100))
  return (
    <div className="min-w-28" data-testid="vida-restante" data-color={color}>
      <div className="flex items-baseline justify-between text-xs">
        <span className={clsx('num font-bold', TEXTO[color])}>{numero(dias)} días</span>
        <span className="text-suave">de {numero(vidaUtil)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-superficie-2" role="meter" aria-valuemin={0} aria-valuemax={vidaUtil} aria-valuenow={dias} aria-label={`Vida restante: ${dias} días de ${vidaUtil}`}>
        <div className={clsx('h-full rounded-full', CLASE[color])} style={{ width: `${ancho}%` }} />
      </div>
    </div>
  )
}
