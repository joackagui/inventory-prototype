import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nombreAlmacen } from '../../api/consultas'
import type { ResumenTablero } from '../../api/tipos'
import { compacto, dinero } from '../../utils/formato'

export function GraficoValor({ datos }: { datos: ResumenTablero['valorPorAlmacen'] }) {
  return (
    <div className="h-44" role="img" aria-label={datos.map((d) => `${d.nombre}: ${dinero(d.valor)}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos.map((d) => ({ ...d, nombre: nombreAlmacen(d.almacen) }))} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 10 }}>
          <CartesianGrid stroke="var(--rejilla)" horizontal={false} />
          <XAxis type="number" tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="nombre" width={110} tick={{ fill: 'var(--texto)', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--superficie-2)' }} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }} formatter={(v) => [dinero(Number(v)), 'Valor']} />
          <Bar dataKey="valor" fill="var(--acento)" radius={[0, 8, 8, 0]} maxBarSize={30}>
            <LabelList dataKey="valor" position="right" formatter={(v) => dinero(Number(v))} style={{ fill: 'var(--texto)', fontWeight: 600, fontSize: 13 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
