import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api, ErrorApi } from '../../api/cliente'
import { useQuery } from '@tanstack/react-query'
import { useAlertas, useClientes, useSaldosEnvases } from '../../api/consultas'
import { PanelLateral } from '../../componentes/PanelLateral'
import type { SaldoEnvase } from '../../api/tipos'
import type { ConEfecto } from '../../api/tipos'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { antiguedad, fecha, numero } from '../../utils/formato'
import { SelectorAlmacenOperacion, SelectorArticulo, useAlmacenOperacion } from './comun'

type DetalleSaldo = SaldoEnvase & { delCliente: SaldoEnvase[]; movimientos: { id: number; tipo: string; cantidad: number; motivo: string; fechaOperacion: string; usuario: { codigo: string } }[] }

// Detalle de un saldo (GET /envases/saldos/:id): todas las entregas del cliente para ese envase y sus movimientos.
function PanelSaldo({ id, onCerrar }: { id: number | null; onCerrar: () => void }) {
  const { data } = useQuery({ queryKey: ['envases', 'detalle', id], queryFn: () => api<DetalleSaldo>(`/envases/saldos/${id}`), enabled: id !== null })
  if (id === null) return null
  return (
    <PanelLateral abierto onCerrar={onCerrar} titulo={data ? `${data.cliente.codigo} · ${data.articulo.codigo}` : 'Saldo de envases'} descripcion={data ? `${data.almacen.codigo} · pendiente ${numero(data.delCliente.reduce((s, x) => s + x.pendiente, 0))}` : undefined}>
      {!data ? (
        <Esqueleto className="h-64" />
      ) : (
        <div className="space-y-6" data-testid="detalle-saldo">
          <section>
            <h3 className="mb-2 font-semibold">Entregas</h3>
            <ul className="space-y-1 text-sm">
              {data.delCliente.map((s) => (
                <li key={s.id} className={clsx('rounded-lg px-3 py-2', s.id === data.id ? 'bg-acento-suave' : 'bg-superficie-2')}>
                  {fecha(s.fechaEntrega)}: entregado {numero(s.cantidadEntregada)}, devuelto {numero(s.cantidadDevuelta)} · pendiente <b>{numero(s.pendiente)}</b> ({antiguedad(s.antiguedadDias)})
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">Movimientos de control</h3>
            <ul className="divide-y divide-borde text-sm">
              {data.movimientos.map((m) => (
                <li key={m.id} className="flex justify-between py-1.5">
                  <span>
                    {fecha(m.fechaOperacion)} · {m.tipo === 'ENVASE_ENTREGA' ? 'Entrega' : 'Devolución'} · {m.usuario.codigo}
                  </span>
                  <span className="num font-semibold">{numero(Math.abs(m.cantidad))}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PanelLateral>
  )
}

export function Envases() {
  const { fijo, inicial, rol, params } = useAlmacenOperacion()
  const [almacen, setAlmacen] = useState(inicial)
  const [tipo, setTipo] = useState<'entrega' | 'devolucion'>('devolucion')
  const [cliente, setCliente] = useState(params.get('cliente') ?? 'Cliente 001')
  const [articulo, setArticulo] = useState(params.get('articulo') ?? '')
  const [cantidad, setCantidad] = useState('')
  const alm = fijo ?? almacen
  const { data: clientes = [] } = useClientes()
  const saldos = useSaldosEnvases(alm)
  // El color sale de la alerta AL10 vigente del cliente y envase (antigüedad > 30 o > 60 días).
  const al10 = useAlertas('codigo=AL10&estado=VIGENTE&tamano=100').data?.datos ?? []
  const colorDe = (clienteId: number, art: string) => al10.find((a) => a.referenciaId === clienteId && a.articulo?.codigo === art)?.color
  const [detalle, setDetalle] = useState<number | null>(null)
  const operar = useMutation({
    meta: { silencioso: true },
    mutationFn: () => api<{ pendiente: number } & ConEfecto>(`/envases/${tipo}`, { metodo: 'POST', cuerpo: { cliente, articulo, almacen: alm, cantidad: Number(cantidad) } }),
  })
  const opera = rol === 'R06' || rol === 'R07'
  const n = Number(cantidad)
  const valida = articulo && Number.isInteger(n) && n > 0
  const error = operar.error instanceof ErrorApi ? operar.error : null
  return (
    <div className="space-y-6">
      {operar.data && (
        <ResultadoOperacion
          titulo={tipo === 'entrega' ? 'Entrega de envases registrada' : 'Devolución de envases registrada'}
          detalles={[
            ['Cliente', cliente],
            ['Envase', articulo],
            ['Cantidad', numero(n)],
            ['Pendiente del cliente', numero(operar.data.pendiente)],
          ]}
          cambioStock="Control por cantidad, sin FIFO (movimiento de control en ENV-RET)."
          efecto={operar.data.efectoAlertas}
        />
      )}
      <div className="grid gap-6 2xl:grid-cols-2">
        {opera && (
          <Tarjeta titulo="Envases retornables" subtitulo="Entrega y devolución por cliente">
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (valida) operar.mutate()
              }}
            >
              <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-xl border border-borde p-1 sm:col-span-2">
                {(['entrega', 'devolucion'] as const).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)} className={clsx('rounded-lg px-3 py-1.5 text-sm font-semibold', tipo === t ? 'bg-marca text-marca-texto' : 'text-suave')}>
                    {t === 'entrega' ? 'Entrega' : 'Devolución'}
                  </button>
                ))}
              </div>
              <Campo etiqueta="Almacén">
                <SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} fijo={fijo} />
              </Campo>
              <Campo etiqueta="Cliente">
                <select className={campo} value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
                  {clientes.map((c) => (
                    <option key={c.codigo}>{c.codigo}</option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Envase (artículo retornable)">
                <SelectorArticulo valor={articulo} onCambiar={setArticulo} soloRetornables />
              </Campo>
              <Campo etiqueta="Cantidad">
                <input className={campo} type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-label="Cantidad de envases" />
              </Campo>
              {error && (
                <p role="alert" className="rounded-lg bg-rojo-fondo p-3 text-sm text-rojo sm:col-span-2" data-testid="error-envases">
                  {error.codigo === 'DEVOLUCION_EXCEDE' ? `${error.message}. No se puede devolver más de lo entregado.` : error.message}
                </p>
              )}
              <BotonPrimario type="submit" disabled={!valida} cargando={operar.isPending} className="sm:col-span-2">
                Registrar {tipo === 'entrega' ? 'entrega' : 'devolución'}
              </BotonPrimario>
            </form>
          </Tarjeta>
        )}
        <Tarjeta titulo="Saldos por cliente" subtitulo="Antigüedad de cada entrega pendiente (AL10: > 30 días atención, > 60 crítico)">
          {saldos.isPending ? (
            <Esqueleto className="h-48" />
          ) : (
            <table className="w-full text-sm" data-testid="saldos-envases">
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-suave uppercase">
                  {['Cliente', 'Envase', 'Entregado', 'Devuelto', 'Pendiente', 'Antigüedad'].map((t) => (
                    <th key={t} scope="col" className="pb-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {saldos.data?.map((s) => {
                  const color = s.pendiente > 0 ? colorDe(s.clienteId, s.articulo.codigo) : undefined
                  return (
                    <tr key={s.id} onClick={() => setDetalle(s.id)} className={clsx('cursor-pointer hover:bg-superficie-2', s.cliente.codigo === params.get('cliente') && 'bg-acento-suave')} data-saldo={`${s.cliente.codigo}-${s.articulo.codigo}`}>
                      <td className="py-2 font-semibold">
                        <button type="button" className="text-acento hover:underline" onClick={() => setDetalle(s.id)}>
                          {s.cliente.codigo}
                        </button>
                      </td>
                      <td>{s.articulo.codigo}</td>
                      <td className="num">{numero(s.cantidadEntregada)}</td>
                      <td className="num">{numero(s.cantidadDevuelta)}</td>
                      <td className="num font-bold">{numero(s.pendiente)}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          {color && <Semaforo color={color} compacto />}
                          {s.pendiente > 0 ? antiguedad(s.antiguedadDias) : '—'} <span className="text-xs text-suave">({fecha(s.fechaEntrega)})</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="mt-4">
            <Regla>Las devoluciones descuentan primero las entregas más antiguas. No se puede devolver más de lo pendiente.</Regla>
          </div>
        </Tarjeta>
      </div>
      <PanelSaldo id={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}
