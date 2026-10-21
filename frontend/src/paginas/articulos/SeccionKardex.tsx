import { Download } from 'lucide-react'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api/cliente'
import { useKardex, useSerie } from '../../api/consultas'
import type { FilaKardex, Pagina } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { Esqueleto } from '../../componentes/Tarjeta'
import { compacto, dinero, fecha, fechaCorta, numero } from '../../utils/formato'

const TIPOS = ['ENTRADA', 'SALIDA', 'RESERVA', 'LIBERACION_RESERVA', 'TRASLADO_SALIDA', 'TRASLADO_ENTRADA', 'AJUSTE', 'MERMA', 'CONTEO', 'CUARENTENA', 'ENVASE_ENTREGA', 'ENVASE_DEVOLUCION', 'BONIFICACION']
const campo = 'rounded-lg border border-borde bg-superficie px-3 py-2 text-sm'
const TAMANO = 15

// CSV con separador coma y comillas donde haga falta (abre bien en Excel y Google Sheets).
function aCsv(filas: FilaKardex[]) {
  const cab = ['fecha', 'tipo', 'motivo', 'ubicacion', 'lote', 'usuario', 'cantidad', 'costo_unitario', 'valor', 'saldo', 'saldo_valor']
  const celda = (v: unknown) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''))
  return [cab, ...filas.map((f) => [f.fechaOperacion, f.tipo, f.motivo, f.ubicacion, f.lote, f.usuario, f.cantidad, f.costoUnitario, f.valor, f.saldo, f.saldoValor])].map((r) => r.map(celda).join(',')).join('\n')
}

export function SeccionKardex({ codigo, almacen }: { codigo: string; almacen: string }) {
  const [tipo, setTipo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const filtros = new URLSearchParams({ almacenId: almacen, ...(tipo && { tipo }), ...(desde && { desde }), ...(hasta && { hasta }) })
  const kardex = useKardex(codigo, `${filtros}&pagina=${pagina}&tamano=${TAMANO}`, true)
  const serie = useSerie(codigo, almacen, 60, true)
  const paginas = Math.max(1, Math.ceil((kardex.data?.total ?? 0) / TAMANO))

  const exportar = async () => {
    const todo = await api<Pagina<FilaKardex>>(`/articulos/${codigo}/kardex?${filtros}&tamano=5000`)
    const url = URL.createObjectURL(new Blob([aCsv([...todo.datos].reverse())], { type: 'text/csv;charset=utf-8' }))
    const enlace = Object.assign(document.createElement('a'), { href: url, download: `kardex-${codigo}-${almacen}.csv` })
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const s = serie.data
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 font-semibold">Stock físico en los últimos 60 días</h3>
        <p className="mb-3 text-sm text-suave">Saldo al cierre de cada día (desde los movimientos). Los puntos rojos marcan los días en o bajo el ROP.</p>
        {!s ? (
          <Esqueleto className="h-64" />
        ) : (
          <div className="h-64" role="img" aria-label={`Stock de ${codigo} en ${almacen}: hoy ${numero(s.puntos.at(-1)?.saldo)}; ${s.puntos.filter((p) => p.bajoRop).length} días bajo el ROP ${s.rop}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.puntos} margin={{ top: 10, right: 60, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--rejilla)" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fill: 'var(--texto-suave)', fontSize: 11 }} axisLine={false} tickLine={false} interval={9} />
                <YAxis tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }} labelFormatter={(f) => fecha(String(f))} formatter={(v) => [numero(Number(v)), 'Stock']} />
                <ReferenceLine y={s.stockMaximo} stroke="var(--azul)" strokeDasharray="5 3" label={{ value: `Máx ${numero(s.stockMaximo)}`, position: 'right', fill: 'var(--azul)', fontSize: 12 }} />
                <ReferenceLine y={s.rop} stroke="var(--amarillo)" label={{ value: `ROP ${numero(s.rop)}`, position: 'right', fill: 'var(--amarillo)', fontSize: 12 }} />
                <ReferenceLine y={s.stockSeguridad} stroke="var(--rojo)" label={{ value: `SS ${numero(s.stockSeguridad)}`, position: 'right', fill: 'var(--rojo)', fontSize: 12 }} />
                <Line
                  dataKey="saldo"
                  stroke="var(--acento)"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; index?: number; payload?: { bajoRop: boolean } }) => (p.payload?.bajoRop ? <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="var(--rojo)" /> : <g key={p.index} />)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-suave">
          Tipo
          <select className={campo} value={tipo} onChange={(e) => (setTipo(e.target.value), setPagina(1))} aria-label="Tipo de movimiento">
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-suave">
          Desde
          <input type="date" className={campo} value={desde} onChange={(e) => (setDesde(e.target.value), setPagina(1))} aria-label="Desde" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-suave">
          Hasta
          <input type="date" className={campo} value={hasta} onChange={(e) => (setHasta(e.target.value), setPagina(1))} aria-label="Hasta" />
        </label>
        <button type="button" onClick={exportar} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-borde px-3 py-2 text-sm font-semibold hover:bg-superficie-2">
          <Download aria-hidden className="size-4" /> Exportar CSV
        </button>
      </div>

      {kardex.isPending ? (
        <Esqueleto className="h-80" />
      ) : !kardex.data?.datos.length ? (
        <EstadoVacio titulo="Sin movimientos con estos filtros" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="kardex">
            <caption className="sr-only">Kardex valorado, del más reciente al más antiguo</caption>
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-suave uppercase">
                {['Fecha', 'Tipo', 'Motivo', 'Lote', 'Usuario'].map((t) => (
                  <th key={t} scope="col" className="pb-2">
                    {t}
                  </th>
                ))}
                {['Cantidad', 'Costo', 'Valor', 'Saldo', 'Saldo USD'].map((t) => (
                  <th key={t} scope="col" className="pb-2 text-right">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {kardex.data.datos.map((m) => (
                <tr key={m.id} className={m.fisico ? undefined : 'text-suave'}>
                  <td className="num py-2">{fecha(m.fechaOperacion)}</td>
                  <td className="py-2 font-semibold">{m.tipo.replaceAll('_', ' ').toLowerCase()}</td>
                  <td className="max-w-64 truncate py-2" title={m.motivo}>
                    {m.motivo}
                  </td>
                  <td className="py-2">{m.lote ?? '—'}</td>
                  <td className="py-2">{m.usuario}</td>
                  <td className={`num py-2 text-right font-semibold ${m.fisico ? (m.cantidad < 0 ? 'text-rojo' : 'text-verde') : ''}`}>{m.cantidad > 0 ? `+${numero(m.cantidad)}` : numero(m.cantidad)}</td>
                  <td className="num py-2 text-right">{numero(m.costoUnitario, 2)}</td>
                  <td className="num py-2 text-right">{numero(m.valor, 2)}</td>
                  <td className="num py-2 text-right font-bold">{numero(m.saldo)}</td>
                  <td className="num py-2 text-right">{dinero(m.saldoValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav className="mt-3 flex items-center justify-end gap-2 text-sm" aria-label="Paginación del kardex">
            <span className="text-suave">
              Página {pagina} de {paginas} · {numero(kardex.data.total)} movimientos
            </span>
            <button type="button" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="rounded-lg border border-borde px-3 py-1.5 disabled:opacity-40">
              Anterior
            </button>
            <button type="button" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} className="rounded-lg border border-borde px-3 py-1.5 disabled:opacity-40">
              Siguiente
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
