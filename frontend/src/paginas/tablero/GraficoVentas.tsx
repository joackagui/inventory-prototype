import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResumenTablero } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { compacto, dinero, fecha, fechaCorta, numero } from '../../utils/formato'

export function GraficoVentas({ serie }: { serie: ResumenTablero['ventasDiarias'] }) {
  if (!serie.some((d) => d.unidades)) return <EstadoVacio titulo="Sin ventas en el período" />
  const total = serie.reduce((s, d) => s + d.usd, 0)
  return (
    <div>
      <p className="mb-3 text-sm text-suave">
        Total del período: <span className="num font-semibold text-texto">{dinero(total)}</span>
      </p>
      <div className="h-[19rem]" role="img" aria-label={`Ventas de los últimos 30 días hábiles, total ${dinero(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--rejilla)" vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fill: 'var(--texto-suave)', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis yAxisId="usd" tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
            <YAxis yAxisId="u" orientation="right" tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }}
              labelFormatter={(f) => fecha(String(f))}
              formatter={(valor, nombre) => [nombre === 'USD' ? dinero(Number(valor)) : numero(Number(valor)), nombre]}
            />
            <Bar yAxisId="usd" dataKey="usd" name="USD" fill="var(--acento)" radius={[5, 5, 0, 0]} maxBarSize={18} />
            <Line yAxisId="u" dataKey="unidades" name="Unidades" stroke="var(--texto-suave)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
