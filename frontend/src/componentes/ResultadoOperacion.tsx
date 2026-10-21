import clsx from 'clsx'
import { ArrowRight, CircleCheck, LogOut, Minus, Plus, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AlertaEfecto, CapaConsumida, EfectoAlertas } from '../api/tipos'
import { dinero, fecha, numero } from '../utils/formato'
import { SEMAFORO, Semaforo } from './Semaforo'

interface Props {
  titulo: string
  detalles: [string, ReactNode][]
  capas?: CapaConsumida[]
  costoTotal?: number
  efecto?: EfectoAlertas
  cambioStock?: string
  acciones?: ReactNode
}

function LineaEfecto({ a, tipo }: { a: AlertaEfecto; tipo: 'creada' | 'resuelta' | 'cambiada' }) {
  const Icono = tipo === 'creada' ? Plus : tipo === 'resuelta' ? Minus : RefreshCw
  const color = a.colorDespues ?? a.colorAntes!
  const texto = tipo === 'creada' ? 'creada' : tipo === 'resuelta' ? 'resuelta' : `${SEMAFORO[a.colorAntes!].texto} → ${SEMAFORO[a.colorDespues!].texto}`
  return (
    <li className="flex items-start gap-2 text-sm" data-efecto={tipo} data-codigo={a.codigo}>
      <Icono aria-hidden className={clsx('mt-0.5 size-4 shrink-0', tipo === 'resuelta' ? 'text-verde' : tipo === 'creada' ? 'text-rojo' : 'text-amarillo')} />
      <Semaforo color={color} compacto />
      <span>
        <b>
          {a.codigo} {texto}
        </b>{' '}
        <span className="text-suave">
          {a.almacen ?? 'Sistema'}
          {a.articulo ? ` · ${a.articulo}` : ''}
        </span>
        <span className="block text-suave">{a.mensaje}</span>
        {a.articulo && (
          <Link to={`/articulos/${a.articulo}`} className="text-xs font-semibold text-acento hover:underline">
            Ver artículo
          </Link>
        )}
      </span>
    </li>
  )
}

// Panel de resultado de una operación: lo registrado, las capas FIFO que salieron con su costo y el efecto en alertas.
export function ResultadoOperacion({ titulo, detalles, capas, costoTotal, efecto, cambioStock, acciones }: Props) {
  const cambios = efecto ? efecto.creadas.length + efecto.resueltas.length + efecto.cambiadas.length : 0
  return (
    <section className="entrar space-y-5 rounded-2xl border-2 border-verde bg-superficie p-5 shadow-tarjeta" aria-live="polite" data-testid="resultado-operacion">
      <header className="flex items-center gap-2">
        <CircleCheck aria-hidden className="size-6 text-verde" />
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </header>
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {detalles.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-superficie-2 px-3 py-2">
            <dt className="text-xs text-suave">{k}</dt>
            <dd className="num font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {cambioStock && <p className="text-sm font-semibold">{cambioStock}</p>}
      {capas && capas.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Capas FIFO que salieron (movimientos generados: {capas.length})</h3>
          <ol className="flex flex-wrap items-center gap-2" aria-label="Capas consumidas, de la primera a la última" data-testid="capas-consumidas">
            {capas.map((c, i) => (
              <li key={`${c.capaId}-${i}`} className="flex items-center gap-2">
                {i > 0 && <ArrowRight aria-hidden className="size-4 text-suave" />}
                <span className="rounded-xl border border-borde bg-superficie-2 px-3 py-2 text-sm" data-lote={c.lote}>
                  <span className="block font-semibold">{c.lote}</span>
                  <span className="num block">
                    {numero(c.cantidad)} × {numero(c.costoUnitario, 2)} = <b>{dinero(c.valor)}</b>
                  </span>
                  <span className="num block text-xs text-suave">vence {fecha(c.vencimiento)}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-1 text-sm font-semibold text-suave">
              <LogOut aria-hidden className="size-4" /> salida
            </li>
          </ol>
          {costoTotal !== undefined && (
            <p className="mt-2 text-sm">
              Costo FIFO total:{' '}
              <span className="num text-lg font-bold" data-testid="costo-total">
                {dinero(Math.abs(costoTotal))}
              </span>
            </p>
          )}
        </div>
      )}
      {efecto && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Efecto en alertas {cambios ? `(${cambios})` : ''}</h3>
          {cambios ? (
            <ul className="space-y-2" data-testid="efecto-alertas">
              {efecto.creadas.map((a) => (
                <LineaEfecto key={`c${a.id}`} a={a} tipo="creada" />
              ))}
              {efecto.resueltas.map((a) => (
                <LineaEfecto key={`r${a.id}`} a={a} tipo="resuelta" />
              ))}
              {efecto.cambiadas.map((a) => (
                <LineaEfecto key={`x${a.id}`} a={a} tipo="cambiada" />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Ninguna alerta cambió.</p>
          )}
          <Link to="/alertas" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-acento hover:underline">
            Ir al centro de alertas <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
      {acciones}
    </section>
  )
}
