import { useState } from 'react'
import { useAlertasAccion, useAlmacenes, useFecha, useNombreAlmacen, useSemaforos, useTablero, useUsuarioActual } from '../../api/consultas'
import type { FilaSemaforo } from '../../api/tipos'
import { EstadoError } from '../../componentes/Estados'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { fecha as formatoFecha, numero } from '../../utils/formato'
import { AlertasAccion } from './AlertasAccion'
import { GraficoStock } from './GraficoStock'
import { GraficoValor } from './GraficoValor'
import { GraficoVentas } from './GraficoVentas'
import { Kpis } from './Kpis'
import { MatrizSemaforo } from './MatrizSemaforo'
import { PanelDetalle } from './PanelDetalle'
import { VistaPreventista } from './VistaPreventista'

export function Tablero() {
  const { rol } = useUsuarioActual()
  if (!rol) return <Esqueleto className="h-96 w-full" />
  return rol === 'R01' ? <VistaPreventista /> : <TableroCompleto />
}

function TableroCompleto() {
  const { almacen } = useSesion()
  const { data: fecha } = useFecha()
  const resumen = useTablero(almacen)
  const { data: almacenes = [] } = useAlmacenes()
  const nombreAlmacen = useNombreAlmacen()
  const columnas = almacen === 'TODOS' ? almacenes.map((a) => a.codigo) : [almacen]
  const semaforos = useSemaforos(columnas)
  const alertas = useAlertasAccion(almacen)
  const [seleccion, setSeleccion] = useState<{ almacen: string; fila: FilaSemaforo } | null>(null)
  const [almacenGrafico, setAlmacenGrafico] = useState<string>('CD-LP-01')
  const codigoGrafico = almacen === 'TODOS' ? almacenGrafico : almacen
  const filasGrafico = semaforos.find((s) => s.data?.almacen === codigoGrafico)?.data?.articulos

  const a = resumen.data?.alertas
  return (
    // La clave reinicia la animación de entrada al cambiar de almacén.
    <div key={almacen} className="space-y-6">
      <div className="entrar flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablero</h1>
          <p className="mt-1 text-suave">
            {almacen === 'TODOS' ? 'Los 3 almacenes' : `${almacen} · ${nombreAlmacen(almacen)}`} · operación del {formatoFecha(fecha?.fechaSimulada)}
          </p>
        </div>
        {a && (
          <p className="flex flex-wrap items-center gap-2 text-sm" aria-label="Alertas vigentes">
            <span className="rounded-full bg-superficie px-3 py-1 font-semibold shadow-tarjeta">
              <span className="num" data-testid="alertas-vigentes">
                {a.total}
              </span>{' '}
              alertas vigentes
            </span>
            <span className="rounded-full bg-rojo-fondo px-3 py-1 font-semibold text-rojo">
              <span className="num">{a.porColor.ROJO}</span> rojas
            </span>
            <span className="rounded-full bg-amarillo-fondo px-3 py-1 font-semibold text-amarillo">
              <span className="num">{a.porColor.AMARILLO}</span> amarillas
            </span>
            <span className="rounded-full bg-azul-fondo px-3 py-1 font-semibold text-azul">
              <span className="num">{a.porColor.AZUL}</span> azules
            </span>
            {a.escaladas > 0 && <span className="rounded-full bg-marca px-3 py-1 font-semibold text-marca-texto">{numero(a.escaladas)} escaladas</span>}
          </p>
        )}
      </div>

      {resumen.isError ? <EstadoError error={resumen.error} reintentar={() => resumen.refetch()} /> : <Kpis datos={resumen.data} />}

      <div className="grid gap-6 2xl:grid-cols-12">
        <Tarjeta className="2xl:col-span-7" titulo="Semáforo por artículo y almacén" subtitulo="Color = alerta vigente más grave · clic en una celda para ver el detalle">
          <MatrizSemaforo semaforos={semaforos.map((s) => s.data)} cargando={semaforos.some((s) => s.isPending)} onSeleccionar={(almacenCodigo, fila) => setSeleccion({ almacen: almacenCodigo, fila })} />
        </Tarjeta>
        <Tarjeta className="2xl:col-span-5" titulo="Alertas que requieren acción" subtitulo="Las 6 más graves: rojas sin atender primero">
          <AlertasAccion consulta={alertas} />
        </Tarjeta>

        <Tarjeta
          className="2xl:col-span-7"
          titulo="Stock disponible frente a SS, ROP y Máx"
          subtitulo={`${codigoGrafico} · ${nombreAlmacen(codigoGrafico)} · barras coloreadas según su estado`}
          acciones={
            almacen === 'TODOS' && (
              <div role="radiogroup" aria-label="Almacén del gráfico" className="inline-flex rounded-lg border border-borde p-0.5">
                {almacenes.map((x) => (
                  <button key={x.codigo} role="radio" aria-checked={almacenGrafico === x.codigo} onClick={() => setAlmacenGrafico(x.codigo)} className={`rounded-md px-2.5 py-1 text-sm font-semibold ${almacenGrafico === x.codigo ? 'bg-acento-suave text-acento' : 'text-suave'}`}>
                    {x.corto}
                  </button>
                ))}
              </div>
            )
          }
        >
          {filasGrafico ? <GraficoStock filas={filasGrafico} /> : <Esqueleto className="h-80" />}
        </Tarjeta>
        <Tarjeta className="2xl:col-span-5" titulo="Ventas diarias" subtitulo="Últimos 30 días de despacho cerrados · USD a precio de lista y unidades (movimientos de salida)">
          {resumen.data ? <GraficoVentas serie={resumen.data.ventasDiarias} /> : <Esqueleto className="h-80" />}
        </Tarjeta>

        {almacen === 'TODOS' && (
          <Tarjeta className="2xl:col-span-12" titulo="Valor del inventario por almacén" subtitulo="Capas FIFO disponibles valoradas a su costo">
            {resumen.data ? <GraficoValor datos={resumen.data.valorPorAlmacen} /> : <Esqueleto className="h-40" />}
          </Tarjeta>
        )}
      </div>

      <PanelDetalle seleccion={seleccion} onCerrar={() => setSeleccion(null)} />
    </div>
  )
}
