import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, ErrorApi } from '../../api/cliente'
import { useClientes, useEstadoArticulos, usePedidos, usePromociones, useStock } from '../../api/consultas'
import type { Pedido } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { antiguedad, numero } from '../../utils/formato'
import { ESTADO_PEDIDO, SelectorAlmacenOperacion, useAlmacenOperacion } from './comun'

interface Faltante {
  articulo: string
  solicitado: number
  disponible: number
  faltante: number
}

function NuevoPedido() {
  const { inicial, params } = useAlmacenOperacion()
  const { data: clientes = [] } = useClientes()
  const { data: articulos = [] } = useEstadoArticulos()
  const { data: promociones = [] } = usePromociones()
  const [cliente, setCliente] = useState('Cliente 001')
  const [almacen, setAlmacen] = useState(inicial)
  const [lineas, setLineas] = useState([{ articulo: params.get('articulo') ?? '', cantidad: '', bonificacion: false }])
  const [faltantes, setFaltantes] = useState<{ numero: string; lista: Faltante[] } | null>(null)
  const stock = useStock(almacen).data?.articulos ?? []
  const vendible = (art: string) => {
    const f = stock.find((s) => s.codigo === art)
    return f ? Math.max(0, f.vendible ?? f.disponible) : null
  }
  const promoDe = (art: string) => promociones.find((p) => p.estado === 'ACTIVA' && p.tipo === 'BONIFICACION' && p.articulo.codigo === art && (!p.almacen || p.almacen.codigo === almacen) && p.topeRestante > 0)
  const crear = useMutation({
    meta: { silencioso: true },
    mutationFn: () => api<Pedido>('/pedidos', { metodo: 'POST', cuerpo: { cliente, almacen, lineas: lineas.map((l) => ({ articulo: l.articulo, cantidad: Number(l.cantidad), bonificacion: l.bonificacion || undefined })) } }),
    onMutate: () => setFaltantes(null),
    onError: (e) => {
      const d = e instanceof ErrorApi ? (e.detalles as { numero?: string; faltantes?: Faltante[] } | null) : null
      if (d?.faltantes) setFaltantes({ numero: d.numero!, lista: d.faltantes })
    },
  })
  const fijar = (i: number, cambio: Partial<(typeof lineas)[number]>) => setLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const valido = lineas.every((l) => l.articulo && Number.isInteger(Number(l.cantidad)) && Number(l.cantidad) > 0)
  const otroError = crear.error && !faltantes ? crear.error : null
  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (valido) crear.mutate()
        }}
        data-testid="form-pedido"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cliente">
            <select className={campo} value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
              {clientes.map((c) => (
                <option key={c.codigo}>{c.codigo}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Almacén">
            <SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} />
          </Campo>
        </div>
        <ul className="space-y-3">
          {lineas.map((l, i) => {
            const v = l.articulo ? vendible(l.articulo) : null
            const promo = l.articulo ? promoDe(l.articulo) : undefined
            const excede = v !== null && Number(l.cantidad) > v
            return (
              <li key={i} className="grid items-end gap-3 rounded-xl bg-superficie-2 p-3 sm:grid-cols-[2fr_1fr_auto_auto]">
                <Campo etiqueta={`Artículo ${i + 1}`}>
                  <select className={campo} value={l.articulo} onChange={(e) => fijar(i, { articulo: e.target.value, bonificacion: false })} aria-label={`Artículo ${i + 1}`}>
                    <option value="">Elige un artículo</option>
                    {articulos.map((a) => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} · {a.descripcion}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Cantidad" error={excede ? `Supera lo vendible (${numero(v)})` : null} ayuda={v !== null ? `Vendible hoy: ${numero(v)}` : undefined}>
                  <input className={campo} type="number" min={1} value={l.cantidad} onChange={(e) => fijar(i, { cantidad: e.target.value })} aria-label={`Cantidad ${i + 1}`} />
                </Campo>
                <label className={clsx('flex items-center gap-2 pb-2 text-sm', !promo && 'opacity-50')} title={promo ? `Promoción ${promo.nombre}` : 'Sin promoción de bonificación activa'}>
                  <input type="checkbox" disabled={!promo} checked={l.bonificacion} onChange={(e) => fijar(i, { bonificacion: e.target.checked })} />
                  Bonificación {promo && <span className="num text-xs text-suave">(tope {numero(promo.topeRestante)})</span>}
                </label>
                <button type="button" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} disabled={lineas.length === 1} className="mb-1 rounded-lg p-2 hover:bg-superficie disabled:opacity-30" aria-label={`Quitar línea ${i + 1}`}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setLineas([...lineas, { articulo: '', cantidad: '', bonificacion: false }])} className="inline-flex items-center gap-1.5 rounded-lg border border-borde px-3 py-2 text-sm font-semibold">
            <Plus aria-hidden className="size-4" /> Agregar línea
          </button>
          <BotonPrimario type="submit" disabled={!valido} cargando={crear.isPending} className="ml-auto">
            Crear pedido y reservar
          </BotonPrimario>
        </div>
      </form>
      <Regla>La reserva es todo o nada: solo se reserva lo vendible (capas con 15 días o más de vida, menos lo ya reservado). Si algún artículo no alcanza, el pedido queda pendiente de revisión y no reserva nada.</Regla>
      {faltantes && (
        <section role="alert" className="rounded-2xl border-2 border-amarillo bg-amarillo-fondo p-4" data-testid="faltantes">
          <h3 className="font-semibold text-amarillo">No alcanza el stock: el pedido {faltantes.numero} quedó pendiente de revisión</h3>
          <p className="mt-1 text-sm">No se reservó nada. El asistente de pedidos (R03) lo revisará: reprogramar, sustituir o cancelar.</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col">Artículo</th>
                <th scope="col" className="text-right">
                  Solicitado
                </th>
                <th scope="col" className="text-right">
                  Vendible
                </th>
                <th scope="col" className="text-right">
                  Faltante
                </th>
              </tr>
            </thead>
            <tbody>
              {faltantes.lista.map((f) => (
                <tr key={f.articulo} className="border-t border-borde">
                  <td className="py-1.5 font-semibold">{f.articulo}</td>
                  <td className="num text-right">{numero(f.solicitado)}</td>
                  <td className="num text-right">{numero(f.disponible)}</td>
                  <td className="num text-right font-bold text-rojo" data-testid="faltante">
                    {numero(f.faltante)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {otroError && (
        <p role="alert" className="rounded-lg bg-rojo-fondo p-3 text-sm text-rojo">
          {otroError.message}
        </p>
      )}
      {crear.data && (
        <ResultadoOperacion
          titulo={`Pedido ${crear.data.numero} confirmado: stock reservado`}
          detalles={[['Cliente', crear.data.cliente.codigo], ['Almacén', crear.data.almacen.codigo], ...crear.data.lineas.map((l): [string, string] => [l.articulo.codigo, `${numero(l.cantidad)} reservadas${l.bonificacion ? ' (bonificación)' : ''}`])]}
          cambioStock="Movimientos generados: RESERVA (el disponible baja; el stock físico sale al despachar)."
          efecto={crear.data.efectoAlertas}
        />
      )}
    </div>
  )
}

export function Pedidos() {
  const { rol, usuario, params } = useAlmacenOperacion()
  const { almacen } = useSesion()
  const filtro = rol === 'R06' ? (usuario?.almacen?.codigo ?? almacen) : almacen
  const lista = usePedidos(filtro)
  const [resultado, setResultado] = useState<{ tipo: 'despacho' | 'cancelacion'; datos: Pedido & { pedido?: string } } | null>(null)
  const accion = useMutation({
    mutationFn: ({ id, tipo }: { id: number; tipo: 'despachar' | 'cancelar' }) => api<Pedido & { pedido?: string }>(`/pedidos/${id}/${tipo}`, { metodo: 'POST' }),
    onSuccess: (datos, v) => setResultado({ tipo: v.tipo === 'despachar' ? 'despacho' : 'cancelacion', datos }),
  })
  const puedeDespachar = (p: Pedido) => p.estado === 'CONFIRMADO' && (rol === 'R07' || (rol === 'R06' && usuario?.almacen?.codigo === p.almacen.codigo))
  const puedeCancelar = (p: Pedido) => (p.estado === 'CONFIRMADO' || p.estado === 'PENDIENTE_REVISION') && (rol === 'R01' || rol === 'R07' || (rol === 'R06' && usuario?.almacen?.codigo === p.almacen.codigo))
  const resaltado = Number(params.get('id'))
  return (
    <div className="space-y-6">
      {(rol === 'R01' || rol === 'R07') && (
        <Tarjeta titulo="Nuevo pedido simulado" subtitulo={rol === 'R07' ? 'Como coordinador puedes simularlo para la demo' : 'Reserva el stock en el momento'}>
          <NuevoPedido />
        </Tarjeta>
      )}
      {resultado &&
        (resultado.tipo === 'despacho' ? (
          <ResultadoOperacion
            titulo={`Pedido ${resultado.datos.pedido} despachado con FIFO`}
            detalles={[['Estado', 'DESPACHADO'], ['Movimientos', `SALIDA × ${resultado.datos.capasConsumidas?.length ?? 0}`]]}
            capas={resultado.datos.capasConsumidas}
            costoTotal={resultado.datos.costoTotal}
            cambioStock={`−${numero(resultado.datos.capasConsumidas?.reduce((s, c) => s + c.cantidad, 0))} cajas de stock físico; la reserva se libera.`}
            efecto={resultado.datos.efectoAlertas}
          />
        ) : (
          <ResultadoOperacion titulo={`Pedido ${resultado.datos.numero} cancelado`} detalles={[['Estado', 'CANCELADO']]} cambioStock="Movimientos generados: LIBERACION_RESERVA." efecto={resultado.datos.efectoAlertas} />
        ))}
      <Tarjeta titulo="Pedidos" subtitulo="Más recientes primero">
        {lista.isPending ? (
          <Esqueleto className="h-64" />
        ) : !lista.data?.length ? (
          <EstadoVacio titulo="Sin pedidos" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="lista-pedidos">
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-suave uppercase">
                  {['Pedido', 'Cliente', 'Almacén', 'Líneas', 'Estado', 'Antigüedad', ''].map((t) => (
                    <th key={t} scope="col" className="pb-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.data.map((p) => (
                  <tr key={p.id} className={clsx(p.id === resaltado && 'bg-acento-suave')} data-pedido={p.numero}>
                    <td className="py-2.5 font-semibold">{p.numero}</td>
                    <td>{p.cliente.codigo}</td>
                    <td>{p.almacen.codigo}</td>
                    <td>{p.lineas.map((l) => `${l.articulo.codigo} × ${numero(l.cantidad)}${l.bonificacion ? ' (bonif.)' : ''}`).join(', ')}</td>
                    <td>
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO_PEDIDO[p.estado].clase)}>{ESTADO_PEDIDO[p.estado].texto}</span>
                    </td>
                    <td className="text-suave">{antiguedad(p.antiguedadDias)}</td>
                    <td className="space-x-2 py-2 text-right whitespace-nowrap">
                      {puedeDespachar(p) && (
                        <button type="button" disabled={accion.isPending} onClick={() => accion.mutate({ id: p.id, tipo: 'despachar' })} className="rounded-lg bg-marca px-3 py-1.5 font-semibold text-marca-texto disabled:opacity-50">
                          Despachar
                        </button>
                      )}
                      {puedeCancelar(p) && (
                        <button type="button" disabled={accion.isPending} onClick={() => accion.mutate({ id: p.id, tipo: 'cancelar' })} className="rounded-lg border border-borde px-3 py-1.5 font-semibold disabled:opacity-50">
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
