import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compacto, dinero, numero } from '../utils/formato'

export interface BarraPareto {
  etiqueta: string
  valor: number
  porcentajeAcumulado: number
  grupo?: 'A' | 'B' | 'C'
}

// Colores por clase ABC con los tokens del semáforo (A crítica para el negocio, C la cola).
export const COLOR_CLASE = { A: 'var(--acento)', B: 'var(--amarillo)', C: 'var(--texto-suave)' } as const

// Pareto: barras ordenadas por valor, línea de % acumulado y marcas en 80% y 95%. Los datos ya vienen ordenados del backend.
export function GraficoPareto({ datos, marcas = [80, 95], formatoValor = dinero, alto = 'h-80' }: { datos: BarraPareto[]; marcas?: number[]; formatoValor?: (n: number) => string; alto?: string }) {
  const resumen = datos.map((d) => `${d.etiqueta}: ${formatoValor(d.valor)}, ${numero(d.porcentajeAcumulado, 1)}% acumulado${d.grupo ? `, clase ${d.grupo}` : ''}`).join('; ')
  return (
    <figure className={alto} role="img" aria-label={`Pareto. ${resumen}`} data-testid="grafico-pareto">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--rejilla)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="v" tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
          <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }}
            formatter={(v, nombre) => [nombre === '% acumulado' ? `${numero(Number(v), 1)}%` : formatoValor(Number(v)), nombre]}
          />
          {marcas.map((m) => (
            <ReferenceLine key={m} yAxisId="p" y={m} stroke="var(--rojo)" strokeDasharray="4 4" label={{ value: `${m}%`, position: 'insideTopRight', fill: 'var(--rojo)', fontSize: 12 }} />
          ))}
          <Bar yAxisId="v" dataKey="valor" name="Valor" radius={[8, 8, 0, 0]} maxBarSize={64}>
            {datos.map((d) => (
              <Cell key={d.etiqueta} fill={d.grupo ? COLOR_CLASE[d.grupo] : 'var(--acento)'} />
            ))}
          </Bar>
          <Line yAxisId="p" dataKey="porcentajeAcumulado" name="% acumulado" stroke="var(--marca-2)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--marca-2)' }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  )
}
