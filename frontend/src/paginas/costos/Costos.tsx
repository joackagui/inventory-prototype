import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@tanstack/react-query'
import { Info, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api/cliente'
import { useCostos, useFecha, useUsuarioActual } from '../../api/consultas'
import type { Costos as DatosCostos } from '../../api/tipos'
import { BotonPrimario, campo } from '../../componentes/Formulario'
import { Kpi } from '../../componentes/Kpi'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { compacto, decimal, dinero, numero, porcentaje } from '../../utils/formato'
import { Calculator, Package, ShoppingCart, Truck, Warehouse } from 'lucide-react'

const COMPONENTES = [
  { clave: 'adquisicion', titulo: 'Adquisición', definicion: 'Costo FIFO de lo vendido en el mes', icono: Package, color: 'var(--acento)' },
  { clave: 'conservacion', titulo: 'Conservación', definicion: 'Valor del stock promedio × tasa anual ÷ 12', icono: Warehouse, color: 'var(--verde)' },
  { clave: 'pedido', titulo: 'Pedido', definicion: 'Traslados despachados × costo por traslado', icono: Truck, color: 'var(--amarillo)' },
  { clave: 'agotamiento', titulo: 'Agotamiento', definicion: 'Pedidos con faltante × valor perdido por pedido', icono: ShoppingCart, color: 'var(--rojo)' },
] as const

function DialogoTasas({ almacen, mes, actuales, onCerrar }: { almacen: string; mes: string; actuales: DatosCostos['tasas']; onCerrar: () => void }) {
  const [v, setV] = useState({ tasaConservacionAnual: String(actuales.tasaConservacionAnual), costoPorTraslado: String(actuales.costoPorTraslado), valorPedidoAgotamiento: String(actuales.valorPedidoAgotamiento) })
  const [confirmando, setConfirmando] = useState(false)
  const tasas = { tasaConservacionAnual: Number(v.tasaConservacionAnual), costoPorTraslado: Number(v.costoPorTraslado), valorPedidoAgotamiento: Number(v.valorPedidoAgotamiento) }
  const valido = Object.values(tasas).every((n) => Number.isFinite(n) && n >= 0) && tasas.tasaConservacionAnual <= 1
  const previa = useCostos(almacen, mes, useDeferredValue(tasas), valido)
  const base = useCostos(almacen, mes)
  const guardar = useMutation({
    mutationFn: async () => {
      for (const [clave, valor] of Object.entries(tasas)) if (valor !== actuales[clave as keyof typeof tasas]) await api(`/configuracion/${clave}`, { metodo: 'PUT', cuerpo: { valor } })
    },
    onSuccess: onCerrar,
  })
  const filas = COMPONENTES.map((c) => [c.titulo, base.data?.total[c.clave], previa.data?.total[c.clave]] as const)
  return (
    <Dialog.Root open onOpenChange={(a) => !a && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="entrar fixed top-1/2 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borde bg-superficie p-6 shadow-2xl" data-testid="dialogo-tasas">
          <Dialog.Title className="text-xl font-semibold">Parámetros de costos</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-suave">La vista previa la calcula el backend sin guardar. Al confirmar, cada cambio queda en la bitácora.</Dialog.Description>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Tasa de conservación anual
              <input className={`${campo} mt-1`} type="number" step="0.01" min={0} max={1} value={v.tasaConservacionAnual} onChange={(e) => (setConfirmando(false), setV({ ...v, tasaConservacionAnual: e.target.value }))} aria-label="Tasa de conservación anual" />
            </label>
            <label className="text-sm">
              Costo por traslado (USD)
              <input className={`${campo} mt-1`} type="number" min={0} value={v.costoPorTraslado} onChange={(e) => (setConfirmando(false), setV({ ...v, costoPorTraslado: e.target.value }))} aria-label="Costo por traslado" />
            </label>
            <label className="text-sm">
              Valor de un pedido no atendido (USD)
              <input className={`${campo} mt-1`} type="number" min={0} value={v.valorPedidoAgotamiento} onChange={(e) => (setConfirmando(false), setV({ ...v, valorPedidoAgotamiento: e.target.value }))} aria-label="Valor por faltante" />
            </label>
          </div>
          <table className="mt-5 w-full text-sm" data-testid="previa-costos">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col">Componente</th>
                <th scope="col" className="text-right">
                  Actual
                </th>
                <th scope="col" className="text-right">
                  Con los nuevos valores
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map(([t, a, n]) => (
                <tr key={t} className="border-t border-borde" data-componente={t}>
                  <td className="py-1.5 font-semibold">{t}</td>
                  <td className="num text-right text-suave">{dinero(a)}</td>
                  <td className={`num text-right font-bold ${a !== n ? 'text-acento' : ''}`} data-nuevo>
                    {dinero(n)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex items-center justify-end gap-2">
            {confirmando && <p className="mr-auto text-sm text-amarillo">¿Confirmas? Se aplica a todos los cálculos de costos.</p>}
            <Dialog.Close className="rounded-lg border border-borde px-4 py-2">Cancelar</Dialog.Close>
            <BotonPrimario type="button" disabled={!valido} cargando={guardar.isPending} onClick={() => (confirmando ? guardar.mutate() : setConfirmando(true))}>
              {confirmando ? 'Confirmar y guardar' : 'Guardar'}
            </BotonPrimario>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Costos() {
  const { almacen } = useSesion()
  const { rol } = useUsuarioActual()
  const { data: hoy } = useFecha()
  const [mes, setMes] = useState('')
  const mesActual = mes || hoy?.fechaSimulada?.slice(0, 7) || ''
  const { data, isPending } = useCostos(almacen, mesActual || undefined)
  const [editando, setEditando] = useState(false)
  if (isPending || !data) return <Esqueleto className="h-[32rem]" />
  const t = data.tasas
  const a21 = data.articulos.find((a) => a.codigo === 'ART-10021')
  return (
    <div className="space-y-6">
      <div className="entrar flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Costos de inventario</h1>
          <p className="mt-1 text-suave">
            {almacen === 'TODOS' ? 'Los 3 almacenes' : almacen} · {data.diasConsiderados} días considerados
          </p>
        </div>
        <span className="flex items-center gap-2">
          <input type="month" className={campo} value={mesActual} onChange={(e) => setMes(e.target.value)} aria-label="Mes" />
          {rol === 'R07' && (
            <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-2 font-semibold text-marca-texto">
              <SlidersHorizontal aria-hidden className="size-4" /> Parámetros
            </button>
          )}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        {COMPONENTES.map((c, i) => (
          <Kpi key={c.clave} titulo={c.titulo} valor={dinero(data.total[c.clave])} contexto={c.definicion} icono={c.icono} retraso={i * 30} />
        ))}
        <Kpi titulo="Total" valor={dinero(data.total.total)} contexto="Suma de los cuatro componentes" icono={Calculator} tono="AZUL" />
      </div>
      <Tarjeta titulo="Costo por artículo" subtitulo="Barras apiladas por componente">
        <div className="h-80" role="img" aria-label={data.articulos.map((a) => `${a.codigo}: ${dinero(a.total)}`).join('; ')} data-testid="grafico-costos">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.articulos} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--rejilla)" vertical={false} />
              <XAxis dataKey="codigo" tickFormatter={(c: string) => c.replace('ART-', '')} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compacto} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }} formatter={(v, n) => [dinero(Number(v)), n]} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              {COMPONENTES.map((c) => (
                <Bar key={c.clave} dataKey={c.clave} name={c.titulo} stackId="costo" fill={c.color} maxBarSize={64} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Desglose y fórmulas" subtitulo={`Tasas: conservación ${porcentaje(t.tasaConservacionAnual * 100, 0)} anual · ${dinero(t.costoPorTraslado)} por traslado · ${dinero(t.costoAgotamientoPorPedido)} por pedido con faltante (${dinero(t.valorPedidoAgotamiento)} × ${porcentaje(t.margenAgotamiento * 100, 0)})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tabla-costos">
            <thead>
              <tr className="text-left text-xs font-semibold text-suave">
                {['Artículo', 'Vendido', 'Adquisición', 'Stock promedio', 'Conservación', 'Traslados', 'Pedido', 'Faltantes', 'Agotamiento', 'Total'].map((x, i) => (
                  <th key={x} scope="col" className={`pb-2 ${i ? 'text-right' : ''}`}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.articulos.map((a) => (
                <tr key={a.codigo} data-articulo={a.codigo}>
                  <td className="py-2 font-semibold">{a.codigo}</td>
                  <td className="num text-right">{numero(a.unidadesVendidas)}</td>
                  <td className="num text-right" data-adquisicion>
                    {dinero(a.adquisicion)}
                  </td>
                  <td className="num text-right">
                    {numero(a.stockPromedioUnidades)} u. · {dinero(a.valorStockPromedio)}
                  </td>
                  <td className="num text-right" data-conservacion>
                    {dinero(a.conservacion)}
                  </td>
                  <td className="num text-right">{decimal(a.traslados)}</td>
                  <td className="num text-right">{dinero(a.pedido)}</td>
                  <td className="num text-right">{decimal(a.pedidosConFaltante)}</td>
                  <td className="num text-right">{dinero(a.agotamiento)}</td>
                  <td className="num text-right font-bold">{dinero(a.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {a21 && (
          <ol className="num mt-4 space-y-1 rounded-xl bg-superficie-2 p-4 font-mono text-sm" data-testid="formulas-costos">
            <li>
              ART-10021 · Conservación = {dinero(a21.valorStockPromedio)} × {decimal(t.tasaConservacionAnual)} ÷ 12 = {dinero(a21.conservacion)}
            </li>
            <li>
              ART-10021 · Adquisición = Σ salidas × costo FIFO de su capa = {numero(a21.unidadesVendidas)} cajas → {dinero(a21.adquisicion)} (≈ {dinero(a21.unidadesVendidas ? a21.adquisicion / a21.unidadesVendidas : 0)} por caja)
            </li>
            <li>
              Pedido = {decimal(data.total.traslados)} traslados × {dinero(t.costoPorTraslado)} = {dinero(data.total.pedido)} · Agotamiento = {decimal(data.total.pedidosConFaltante)} pedidos × {dinero(t.costoAgotamientoPorPedido)} = {dinero(data.total.agotamiento)}
            </li>
          </ol>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-acento-suave p-3 text-sm" data-testid="nota-documento">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-acento" />
          El ejemplo del documento (ART-10021 en junio: 7,920 cajas × 12.40 = USD 98,208) suma los tres almacenes. Con «Todos» y junio de 2027 esta pantalla muestra {a21 && almacen === 'TODOS' ? `${numero(a21.unidadesVendidas)} cajas y ${dinero(a21.adquisicion)}` : 'el valor comparable'}: el prototipo simula días hábiles (lunes a viernes) y un historial propio, así que se acerca pero no coincide.
        </p>
      </Tarjeta>
      {editando && <DialogoTasas almacen={almacen} mes={mesActual} actuales={t} onCerrar={() => setEditando(false)} />}
    </div>
  )
}
