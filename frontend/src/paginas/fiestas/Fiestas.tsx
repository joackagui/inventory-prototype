import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { CalendarClock, Tag, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api/cliente'
import { useFecha, useFiestas, useNombreAlmacen, useUsuarioActual } from '../../api/consultas'
import type { ArticuloFiesta, Fiesta } from '../../api/tipos'
import { Cronograma } from '../../componentes/Cronograma'
import { EstadoVacio } from '../../componentes/Estados'
import { ESTADO_FIESTA, LineaTiempoFiestas } from '../../componentes/LineaTiempoFiestas'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { decimal, fecha, numero } from '../../utils/formato'

const ESTADO_ARTICULO = { OK: { texto: 'OK', clase: 'bg-verde-fondo text-verde' }, EN_RIESGO: { texto: 'En riesgo', clase: 'bg-amarillo-fondo text-amarillo' }, CRITICO: { texto: 'Crítico', clase: 'bg-rojo-fondo text-rojo' } }

// Fórmulas de la sección 9 con los números del backend (no se recalculan aquí).
function FormulasFiesta({ a }: { a: ArticuloFiesta }) {
  return (
    <ol className="num space-y-1 rounded-xl bg-superficie-2 p-4 font-mono text-sm" data-testid="formulas-fiesta">
      <li>
        ROP fiesta = d × f × L + SS × f = {numero(a.demandaBase)} × {decimal(a.factor)} × {a.leadTimeDias} + {numero(a.stockSeguridad)} × {decimal(a.factor)} = {numero(a.ropFiesta)}
      </li>
      <li>
        Q fiesta = d × f × 7 = {numero(a.demandaBase)} × {decimal(a.factor)} × 7 = {numero(a.qFiesta)}
      </li>
      <li>
        Máx fiesta = ROP + Q = {numero(a.ropFiesta)} + {numero(a.qFiesta)} = {numero(a.maximoFiesta)}
      </li>
      <li>
        Pronóstico = d × f × días = {numero(a.demandaBase)} × {decimal(a.factor)} × {a.diasFiesta} = {numero(a.pronostico)} · brecha = {numero(a.pronostico)} − {numero(a.posicion)} = {numero(a.brecha)}
      </li>
    </ol>
  )
}

function DetalleFiesta({ f }: { f: Fiesta }) {
  const { rol } = useUsuarioActual()
  const nombre = useNombreAlmacen()
  const [elegido, setElegido] = useState<{ almacen: string; codigo: string }>(() => {
    const critico = f.almacenes.flatMap((a) => a.articulos.map((x) => ({ almacen: a.almacen, ...x }))).find((x) => x.estado === 'CRITICO')
    return critico ? { almacen: critico.almacen, codigo: critico.codigo } : { almacen: f.almacenes[0]?.almacen ?? '', codigo: f.almacenes[0]?.articulos[0]?.codigo ?? '' }
  })
  const acercar = useMutation({
    mutationFn: () => api<{ fechaSimulada: string }>('/simulacion/fecha', { metodo: 'PUT', cuerpo: { fecha: f.ventanaDesde } }),
    onSuccess: (r) => toast.warning(`Fecha simulada movida al ${fecha(r.fechaSimulada)}`, { description: `Inicio de la preparación de ${f.nombre}. Todo el sistema ve esta fecha; vuelve con «Restablecer al 30/06/2027».` }),
  })
  const articulo = f.almacenes.find((a) => a.almacen === elegido.almacen)?.articulos.find((x) => x.codigo === elegido.codigo)
  const sugerida = f.almacenes.flatMap((a) => a.articulos).find((x) => x.estado !== 'OK')?.codigo ?? f.almacenes[0]?.articulos[0]?.codigo
  return (
    <div className="space-y-6" data-testid="detalle-fiesta">
      <Tarjeta
        titulo={f.nombre}
        subtitulo={`${fecha(f.fechaInicio)}${f.fechaFin !== f.fechaInicio ? ` – ${fecha(f.fechaFin)}` : ''} · ${f.diasFiesta} días festivos · zona: ${f.zonas.map((z) => nombre(z)).join(', ')}`}
        acciones={
          <span className="flex flex-wrap items-center gap-2">
            <span className={clsx('rounded-full px-3 py-1 text-sm font-semibold', ESTADO_FIESTA[f.estado].chip)}>{ESTADO_FIESTA[f.estado].texto}</span>
            {rol === 'R07' && !f.pasada && (
              <button type="button" onClick={() => acercar.mutate()} disabled={acercar.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-sm font-semibold">
                <CalendarClock aria-hidden className="size-4" /> Ver la fiesta como si estuviera cerca
              </button>
            )}
          </span>
        }
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Factor f', decimal(f.factor)],
            ['Faltan', f.pasada ? 'Ya pasó' : `${numero(f.diasFaltan)} días`],
            ['Preparación', `${f.semanasPreparacion} semanas (desde ${fecha(f.ventanaDesde)})`],
            ['¿En ventana?', f.enVentanaPreparacion ? 'Sí, preparar ahora' : 'Todavía no'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-superficie-2 px-3 py-2">
              <dt className="text-xs text-suave">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>
      <div className="grid gap-6 2xl:grid-cols-[2fr_3fr]">
        <Tarjeta titulo="Cronograma de preparación" subtitulo="Estado según la fecha simulada">
          <Cronograma hitos={f.cronograma} />
        </Tarjeta>
        <div className="space-y-6">
          {f.almacenes.length === 0 ? (
            <Tarjeta titulo="Artículos">
              <EstadoVacio titulo="El almacén elegido no está en la zona de esta fiesta" />
            </Tarjeta>
          ) : (
            f.almacenes.map((a) => {
              const brechas = a.articulos.filter((x) => x.brecha > 0)
              return (
                <Tarjeta
                  key={a.almacen}
                  titulo={`Preparación en ${nombre(a.almacen)}`}
                  subtitulo="Clic en un artículo para ver sus fórmulas"
                  acciones={
                    <span className="flex gap-2">
                      {rol === 'R07' && brechas.length > 0 && (
                        <Link to={`/operaciones?tipo=traslados&almacen=${a.almacen}&extraordinario=${brechas.map((x) => `${x.codigo}:${x.brecha}`).join(',')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-marca-texto">
                          <Truck aria-hidden className="size-4" /> Crear traslados extraordinarios
                        </Link>
                      )}
                      {rol === 'R02' && (
                        <Link
                          to={`/operaciones?tipo=promociones&articulo=${sugerida}&almacen=${a.almacen}&tipoPromo=${f.promocionSugerida.tipo}&desde=${f.promocionSugerida.desde}&hasta=${f.promocionSugerida.hasta}&nombre=${encodeURIComponent(`Promo ${f.nombre}`)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-marca-texto"
                        >
                          <Tag aria-hidden className="size-4" /> Proponer promoción festiva
                        </Link>
                      )}
                    </span>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid={`fiesta-${a.almacen}`}>
                      <thead>
                        <tr className="text-left text-xs font-semibold text-suave">
                          {['Artículo', 'd', 'ROP fiesta', 'Q fiesta', 'Máx fiesta', 'Pronóstico', 'Posición', 'Brecha', 'Estado'].map((t, i) => (
                            <th key={t} scope="col" className={clsx('pb-2', i > 0 && i < 8 && 'text-right')}>
                              {t}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde">
                        {a.articulos.map((x) => (
                          <tr key={x.codigo} onClick={() => setElegido({ almacen: a.almacen, codigo: x.codigo })} className={clsx('cursor-pointer hover:bg-superficie-2', elegido.almacen === a.almacen && elegido.codigo === x.codigo && 'bg-acento-suave')} data-articulo={x.codigo} data-estado={x.estado}>
                            <td className="py-2 font-semibold">{x.codigo}</td>
                            <td className="num text-right">{numero(x.demandaBase)}</td>
                            <td className="num text-right">{numero(x.ropFiesta)}</td>
                            <td className="num text-right">{numero(x.qFiesta)}</td>
                            <td className="num text-right">{numero(x.maximoFiesta)}</td>
                            <td className="num text-right">{numero(x.pronostico)}</td>
                            <td className="num text-right">{numero(x.posicion)}</td>
                            <td className={clsx('num text-right font-semibold', x.brecha > 0 && 'text-rojo')}>{numero(x.brecha)}</td>
                            <td className="pl-3">
                              <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO_ARTICULO[x.estado].clase)}>{ESTADO_ARTICULO[x.estado].texto}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Tarjeta>
              )
            })
          )}
          {articulo && (
            <Tarjeta titulo={`Fórmulas · ${articulo.codigo} en ${nombre(elegido.almacen)}`} subtitulo="Crítico: la posición no cubre el pronóstico (AL14). En riesgo: no llega al ROP de fiesta.">
              <FormulasFiesta a={articulo} />
            </Tarjeta>
          )}
        </div>
      </div>
    </div>
  )
}

export function Fiestas() {
  const { almacen } = useSesion()
  const { data: hoy } = useFecha()
  const { data, isPending } = useFiestas(almacen)
  const [elegida, setElegida] = useState<number | null>(null)
  if (isPending || !data) return <Esqueleto className="h-[32rem]" />
  // Por defecto, la próxima fiesta que no pasó.
  const actual = data.fiestas.find((f) => f.id === elegida) ?? data.fiestas.filter((f) => !f.pasada).sort((a, b) => a.diasFaltan - b.diasFaltan)[0]
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Fiestas</h1>
        <p className="mt-1 text-suave">Calendario 2027, factor estacional, ROP de fiesta, pronóstico y estado de preparación.</p>
      </div>
      <Tarjeta titulo="Calendario de fiestas" subtitulo="Barra = fiesta coloreada por su preparación · sombreado = ventana de preparación · línea azul = fecha simulada">
        <LineaTiempoFiestas fiestas={data.fiestas} fecha={hoy?.fechaSimulada ?? data.fechaOperacion} seleccionada={actual?.id} onElegir={setElegida} />
      </Tarjeta>
      {actual && <DetalleFiesta key={`${actual.id}-${almacen}`} f={actual} />}
    </div>
  )
}
