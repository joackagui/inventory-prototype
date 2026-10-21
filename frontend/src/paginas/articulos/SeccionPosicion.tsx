import type { ResumenAlmacenArticulo } from '../../api/tipos'
import { BarraFuncion, BarraPosicion } from '../../componentes/BarraPosicion'
import { SEMAFORO, Semaforo } from '../../componentes/Semaforo'
import { fecha, numero } from '../../utils/formato'

export function SeccionPosicion({ almacenes }: { almacenes: ResumenAlmacenArticulo[] }) {
  return (
    <div className="grid gap-4 2xl:grid-cols-3">
      {almacenes.map((a) => {
        const p = a.parametros!
        const f = a.funcion!
        return (
          <article key={a.almacen} className="entrar rounded-2xl border border-borde bg-superficie p-5 shadow-tarjeta" style={{ borderTop: `4px solid ${SEMAFORO[a.color ?? 'VERDE'].variable}` }} data-testid={`posicion-${a.almacen}`}>
            <header className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-semibold">{a.nombre}</h3>
              <Semaforo color={a.color ?? 'VERDE'} />
            </header>
            <BarraPosicion disponible={a.disponible} enTransito={a.enTransito ?? 0} reservado={a.reservado ?? 0} ss={p.stockSeguridad} rop={p.rop} max={p.stockMaximo} color={a.color ?? 'VERDE'} />
            <ul className="mt-2 flex flex-wrap gap-x-4 text-xs text-suave" aria-label="Leyenda">
              <li>
                ■ Disponible <span className="num font-semibold text-texto">{numero(a.disponible)}</span>
              </li>
              <li>
                ▨ Tránsito <span className="num font-semibold text-texto">{numero(a.enTransito)}</span>
              </li>
              <li>
                □ Reservado <span className="num font-semibold text-texto">{numero(a.reservado)}</span>
              </li>
            </ul>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              {[
                ['Posición', numero(a.posicion)],
                ['Cobertura', `${numero(a.coberturaDias, 1)} días`],
                ['Traslado propuesto', numero(a.trasladoPropuesto)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-superficie-2 px-3 py-2">
                  <dt className="text-xs text-suave">{k}</dt>
                  <dd className="num font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-suave uppercase">Stock por función</h4>
              <BarraFuncion {...f} />
              {f.fiesta && (
                <p className="mt-1 text-xs text-suave">
                  Estacional = ROP de {f.fiesta.nombre} ({fecha(f.fiesta.fechaInicio)}, f {f.fiesta.factor}) {numero(f.fiesta.ropFiesta)} − ROP {numero(p.rop)}
                </p>
              )}
            </div>
            {a.alertas!.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {a.alertas!.map((x) => (
                  <li key={x.id} className="flex items-start gap-2 text-sm">
                    <Semaforo color={x.color} compacto />
                    <span>
                      <b>{x.codigo}</b> {x.mensaje}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )
      })}
    </div>
  )
}
