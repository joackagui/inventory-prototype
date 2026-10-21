import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FilaSemaforo } from '../../api/tipos'
import { SEMAFORO } from '../../componentes/Semaforo'
import { compacto, numero } from '../../utils/formato'

const REFERENCIAS = [
  { clave: 'stockSeguridad', nombre: 'SS', color: 'var(--rojo)', guiones: '0' },
  { clave: 'rop', nombre: 'ROP', color: 'var(--amarillo)', guiones: '0' },
  { clave: 'stockMaximo', nombre: 'Máx', color: 'var(--azul)', guiones: '5 3' },
] as const

// Marca horizontal sobre cada barra: SS, ROP y Máx son propios de cada artículo.
const Marca = (color: string, guiones: string) =>
  function MarcaReferencia(props: { cx?: number; cy?: number }) {
    if (props.cx == null || props.cy == null) return <g />
    return <line x1={props.cx - 22} x2={props.cx + 22} y1={props.cy} y2={props.cy} stroke={color} strokeWidth={3} strokeDasharray={guiones} strokeLinecap="round" />
  }

export function GraficoStock({ filas }: { filas: FilaSemaforo[] }) {
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-sm text-suave" aria-label="Leyenda">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-verde" aria-hidden /> Disponible (color = estado)
        </li>
        {REFERENCIAS.map((r) => (
          <li key={r.clave} className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden>
              <line x1="1" x2="21" y1="3" y2="3" stroke={r.color} strokeWidth="3" strokeDasharray={r.guiones} strokeLinecap="round" />
            </svg>
            {r.nombre}
          </li>
        ))}
      </ul>
      <div className="h-80" role="img" aria-label={`Stock por artículo: ${filas.map((f) => `${f.codigo} ${f.disponible} (ROP ${f.rop})`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filas} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--rejilla)" vertical={false} />
            <XAxis dataKey="codigo" tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} tickFormatter={(c: string) => c.replace('ART-', '')} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} tickFormatter={compacto} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: 'var(--superficie-2)' }}
              contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }}
              formatter={(valor, nombre) => [numero(Number(valor)), nombre]}
            />
            <Bar dataKey="disponible" name="Disponible" radius={[8, 8, 0, 0]} maxBarSize={56}>
              {filas.map((f) => (
                <Cell key={f.codigo} fill={SEMAFORO[f.color].variable} />
              ))}
            </Bar>
            {REFERENCIAS.map((r) => (
              <Line key={r.clave} dataKey={r.clave} name={r.nombre} stroke="none" isAnimationActive={false} dot={Marca(r.color, r.guiones)} activeDot={false} legendType="none" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
