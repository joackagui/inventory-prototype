import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api/cliente'
import { useAbc, useAlertas, useConteosAnalisis, useNombreAlmacen, useParetoAjustes, useRotacion, useUsuarioActual } from '../../api/consultas'
import { EstadoVacio } from '../../componentes/Estados'
import { campo } from '../../componentes/Formulario'
import { COLOR_CLASE, GraficoPareto } from '../../componentes/GraficoPareto'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { dinero, fecha, numero, porcentaje } from '../../utils/formato'
import { MOTIVOS } from '../operaciones/Ajustes'

const PESTANAS = [
  { id: 'abc', titulo: 'ABC y Pareto' },
  { id: 'ajustes', titulo: 'Ajustes y mermas' },
  { id: 'rotacion', titulo: 'Rotación y cobertura' },
  { id: 'conteos', titulo: 'Conteos y exactitud' },
] as const

function PestanaAbc() {
  const { rol } = useUsuarioActual()
  const { data, isPending } = useAbc()
  const [confirmar, setConfirmar] = useState(false)
  const recalcular = useMutation({ mutationFn: () => api<{ cambios: unknown[] }>('/abc/recalcular', { metodo: 'POST' }), onSuccess: () => setConfirmar(false) })
  if (isPending || !data) return <Esqueleto className="h-96" />
  const cambios = data.filter((a) => a.clase !== a.claseActual)
  return (
    <div className="space-y-6">
      <Tarjeta titulo="Pareto de la venta diaria en USD" subtitulo="Precio × demanda diaria de La Paz, de mayor a menor" acciones={rol === 'R07' && (
        <button type="button" onClick={() => setConfirmar(true)} className="rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-marca-texto">
          Recalcular clasificación
        </button>
      )}>
        <p className="mb-4 text-sm">
          Regla ABC: la clase <b style={{ color: COLOR_CLASE.A }}>A</b> reúne cerca del <b>80%</b> del valor vendido, la <b>B</b> llega hasta el <b>95%</b> y la <b>C</b> es el resto. La clase fija el nivel de servicio (A 98%, B 95%, C 90%) y la frecuencia del conteo cíclico.
        </p>
        <GraficoPareto datos={data.map((a) => ({ etiqueta: a.codigo.replace('ART-', ''), valor: a.ventaDiaria, porcentajeAcumulado: a.porcentajeAcumulado, grupo: a.clase }))} />
      </Tarjeta>
      <Tarjeta titulo="Clasificación">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tabla-abc">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-suave">
                {['Artículo', 'Precio', 'd (LP)', 'Venta diaria', '%', '% acumulado', 'Clase', 'Nivel de servicio', 'Z', 'Conteo cada'].map((t, i) => (
                  <th key={t} scope="col" className={clsx('pb-2', i > 0 && i !== 6 && 'text-right')}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.map((a) => (
                <tr key={a.codigo} data-articulo={a.codigo} data-clase={a.clase}>
                  <th scope="row" className="py-2 text-left font-normal">
                    <b>{a.codigo}</b> <span className="text-suave">{a.descripcion}</span>
                  </th>
                  <td className="num text-right">{dinero(a.precio)}</td>
                  <td className="num text-right">{numero(a.demandaDiaria)}</td>
                  <td className="num text-right font-semibold">{dinero(a.ventaDiaria)}</td>
                  <td className="num text-right">{porcentaje(a.porcentaje, 2)}</td>
                  <td className="num text-right" data-acumulado>
                    {porcentaje(a.porcentajeAcumulado, 2)}
                  </td>
                  <td className="pl-4">
                    <span className="rounded-md px-2 py-0.5 font-bold text-white" style={{ background: COLOR_CLASE[a.clase] }}>
                      {a.clase}
                    </span>
                    {a.clase !== a.claseActual && <span className="ml-2 text-xs text-amarillo">(hoy {a.claseActual})</span>}
                  </td>
                  <td className="num text-right">{porcentaje(a.nivelServicio * 100, 0)}</td>
                  <td className="num text-right">{numero(a.z, 2)}</td>
                  <td className="num text-right">{numero(a.frecuenciaConteoDias)} días</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
      <Dialog.Root open={confirmar} onOpenChange={setConfirmar}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="entrar fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borde bg-superficie p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold">¿Recalcular la clasificación ABC?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-suave">Se recalcula con la demanda actual de La Paz y se actualizan Z, SS, ROP, Q y Máx de los 3 almacenes. Queda en la bitácora.</Dialog.Description>
            <p className="mt-3 text-sm" data-testid="cambios-abc">
              {cambios.length ? `Cambiarían de clase: ${cambios.map((c) => `${c.codigo} (${c.claseActual} → ${c.clase})`).join(', ')}.` : 'Ningún artículo cambia de clase con la demanda actual.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close className="rounded-lg border border-borde px-4 py-2">Cancelar</Dialog.Close>
              <button type="button" onClick={() => recalcular.mutate()} disabled={recalcular.isPending} className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto disabled:opacity-50">
                Recalcular
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function PestanaAjustes() {
  const { almacen } = useSesion()
  const nombre = useNombreAlmacen()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const { data, isPending } = useParetoAjustes({ almacen, desde: desde || undefined, hasta: hasta || undefined })
  const vitales = data?.motivos.filter((_, i) => i === 0 || data.motivos[i - 1].porcentajeAcumulado < 80) ?? []
  const texto = (m: string) => (m === 'DIFERENCIA_RECEPCION' ? 'Diferencia en recepción' : (MOTIVOS.find((x) => x.valor === m)?.texto ?? m))
  return (
    <Tarjeta titulo="Pareto de ajustes y mermas aprobados" subtitulo={`${almacen === 'TODOS' ? 'Los 3 almacenes' : nombre(almacen)} · por valor en USD (bajas y altas)`} acciones={
      <div className="flex gap-2">
        <input type="date" className={campo} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" className={campo} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
      </div>
    }>
      {isPending ? (
        <Esqueleto className="h-64" />
      ) : !data?.motivos.length ? (
        <EstadoVacio titulo="Sin ajustes aprobados en el período">Aprueba ajustes o mermas en Aprobaciones para verlos aquí.</EstadoVacio>
      ) : (
        <div className="space-y-4">
          <GraficoPareto datos={data.motivos.map((m) => ({ etiqueta: texto(m.motivo), valor: m.valor, porcentajeAcumulado: m.porcentajeAcumulado }))} marcas={[80]} alto="h-64" />
          <p className="text-sm">
            <b>Pocos vitales:</b> {vitales.map((m) => texto(m.motivo)).join(', ')} explican cerca del 80% del valor ajustado.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-suave">
                {['Motivo', 'Ajustes', 'Cantidad', 'USD', '%', '% acumulado'].map((t, i) => (
                  <th key={t} scope="col" className={clsx('pb-2', i > 0 && 'text-right')}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.motivos.map((m) => (
                <tr key={m.motivo} className={clsx(vitales.includes(m) && 'bg-amarillo-fondo')}>
                  <td className="py-2 font-semibold">{texto(m.motivo)}</td>
                  <td className="num text-right">{numero(m.ajustes)}</td>
                  <td className="num text-right">{numero(m.unidades)}</td>
                  <td className="num text-right">{dinero(m.valor)}</td>
                  <td className="num text-right">{porcentaje(m.porcentaje, 2)}</td>
                  <td className="num text-right">{porcentaje(m.porcentajeAcumulado, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  )
}

const COLOR_NIVEL = { ALTA: 'var(--verde)', MEDIA: 'var(--amarillo)', BAJA: 'var(--rojo)', SIN_DATOS: 'var(--texto-suave)' } as const
const TEXTO_NIVEL = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', SIN_DATOS: 'Sin datos' } as const

function PestanaRotacion() {
  const { almacen } = useSesion()
  const { data, isPending } = useRotacion(almacen)
  if (isPending || !data) return <Esqueleto className="h-96" />
  return (
    <Tarjeta titulo="Rotación anualizada y cobertura" subtitulo={`Costo de lo vendido del ${fecha(data.desde)} al ${fecha(data.hasta)} (90 días hábiles) × 252/90 ÷ valor del stock promedio`}>
      <p className="mb-4 text-sm">
        Rotación <b style={{ color: COLOR_NIVEL.ALTA }}>alta</b> ≥ {data.umbrales.alta} vueltas al año (el inventario dura unos 8 días hábiles o menos), <b style={{ color: COLOR_NIVEL.MEDIA }}>media</b> ≥ {data.umbrales.media} y <b style={{ color: COLOR_NIVEL.BAJA }}>baja</b> por debajo: capital inmovilizado y más riesgo de vencimiento.
      </p>
      <div className="h-64" role="img" aria-label={data.articulos.map((a) => `${a.codigo}: rotación ${numero(a.rotacionAnual, 1)} (${TEXTO_NIVEL[a.nivel]})`).join('; ')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.articulos} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--rejilla)" vertical={false} />
            <XAxis dataKey="codigo" tickFormatter={(c: string) => c.replace('ART-', '')} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 12, color: 'var(--texto)' }} formatter={(v) => [numero(Number(v), 1), 'Rotación anual']} />
            <Bar dataKey="rotacionAnual" radius={[8, 8, 0, 0]} maxBarSize={56}>
              {data.articulos.map((a) => (
                <Cell key={a.codigo} fill={COLOR_NIVEL[a.nivel]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-4 w-full text-sm" data-testid="tabla-rotacion">
        <thead>
          <tr className="text-left text-xs font-semibold text-suave">
            {['Artículo', 'Costo vendido (90 d.h.)', 'Stock promedio', 'Rotación anual', 'Días de inventario', 'Cobertura actual', 'Nivel'].map((t, i) => (
              <th key={t} scope="col" className={clsx('pb-2', i > 0 && i < 6 && 'text-right')}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {data.articulos.map((a) => (
            <tr key={a.codigo}>
              <td className="py-2">
                <b>{a.codigo}</b> <span className="text-suave">{a.descripcion}</span>
              </td>
              <td className="num text-right">{dinero(a.costoVendido90)}</td>
              <td className="num text-right">{dinero(a.valorStockPromedio)}</td>
              <td className="num text-right font-bold">{numero(a.rotacionAnual, 1)}</td>
              <td className="num text-right">{numero(a.diasInventario, 1)}</td>
              <td className="num text-right">{numero(a.coberturaDias, 1)} días</td>
              <td className="pl-4">
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: COLOR_NIVEL[a.nivel] }}>
                  {TEXTO_NIVEL[a.nivel]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  )
}

function PestanaConteos() {
  const { almacen } = useSesion()
  const { data, isPending } = useConteosAnalisis(almacen)
  const atrasados = useAlertas(`codigo=AL05&estado=VIGENTE&tamano=100${almacen === 'TODOS' ? '' : `&almacen=${almacen}`}`).data?.datos ?? []
  if (isPending || !data) return <Esqueleto className="h-96" />
  return (
    <div className="grid gap-6 2xl:grid-cols-3">
      <Tarjeta titulo="Exactitud del inventario" subtitulo="Conteos sin diferencia de los últimos 90 días">
        <p className="num text-5xl font-bold" data-testid="exactitud">
          {porcentaje(data.exactitud.porcentaje)}
        </p>
        <p className="mt-2 text-sm text-suave">
          {numero(data.exactitud.sinDiferencia)} de {numero(data.exactitud.conteos)} conteos sin diferencia · tolerancia {porcentaje(data.toleranciaPct, 1)}
        </p>
        <h3 className="mt-6 mb-2 font-semibold">Conteos atrasados por clase</h3>
        {atrasados.length ? (
          <ul className="space-y-1 text-sm">
            {atrasados.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Semaforo color={a.color} compacto /> <b>{a.articulo?.codigo}</b> {a.almacen?.codigo} · {a.mensaje}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Ninguno.</p>
        )}
      </Tarjeta>
      <Tarjeta className="2xl:col-span-2" titulo="Conteos recientes">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-suave">
              {['Fecha', 'Artículo', 'Almacén', 'Ubicación', 'Sistema', 'Contado', 'Diferencia', '%'].map((t, i) => (
                <th key={t} scope="col" className={clsx('pb-2', i > 3 && 'text-right')}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {data.conteos.map((c) => (
              <tr key={c.id} className={clsx(c.superaTolerancia && 'bg-rojo-fondo')} title={c.superaTolerancia ? 'Supera la tolerancia: requiere recuento' : undefined}>
                <td className="num py-2">{fecha(c.fecha)}</td>
                <td className="font-semibold">{c.articulo}</td>
                <td>{c.almacen}</td>
                <td>{c.ubicacion}</td>
                <td className="num text-right">{numero(c.sistema)}</td>
                <td className="num text-right">{numero(c.contado)}</td>
                <td className={clsx('num text-right font-semibold', c.diferencia && 'text-rojo')}>{numero(c.diferencia)}</td>
                <td className="num text-right">{porcentaje(c.porcentaje, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  )
}

export function Analisis() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('abc')
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Análisis</h1>
        <p className="mt-1 text-suave">Clasificación ABC, Pareto de ajustes, rotación y exactitud del inventario.</p>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-borde">
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={clsx('-mb-px border-b-2 px-4 py-2 font-semibold', pestana === p.id ? 'border-acento text-acento' : 'border-transparent text-suave hover:text-texto')}>
            {p.titulo}
          </button>
        ))}
      </div>
      {pestana === 'abc' ? <PestanaAbc /> : pestana === 'ajustes' ? <PestanaAjustes /> : pestana === 'rotacion' ? <PestanaRotacion /> : <PestanaConteos />}
    </div>
  )
}
