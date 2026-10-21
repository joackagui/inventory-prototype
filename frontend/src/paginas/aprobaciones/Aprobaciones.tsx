import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { ClipboardCheck, PackageX, ShieldAlert, Tag, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/cliente'
import { useAjusteDetalle, useAjustes, useAlertas, useCapasFiltro, usePromociones, useUsuarioActual } from '../../api/consultas'
import type { Ajuste, CapaListada, ConEfecto, Promocion } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { PanelLateral } from '../../componentes/PanelLateral'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { antiguedad, dinero, fecha, numero } from '../../utils/formato'
import { MOTIVOS } from '../operaciones/Ajustes'
import { AccionesResolucion, motivoNoAprobar } from './AccionesResolucion'

type Seleccion = { tipo: 'ajuste'; id: number } | { tipo: 'promocion'; p: Promocion } | { tipo: 'capa'; c: CapaListada }
type Resultado = { titulo: string; r: ConEfecto & { valor?: number }; nota?: string }

const motivoTexto = (m: string) => (m === 'DIFERENCIA_RECEPCION' ? 'Diferencia en recepción' : (MOTIVOS.find((x) => x.valor === m)?.texto ?? m))

function DetalleAjuste({ id, onResultado }: { id: number; onResultado: (r: Resultado) => void }) {
  const { rol, usuario } = useUsuarioActual()
  const { data: a, isPending } = useAjusteDetalle(id)
  const decidir = useMutation({
    mutationFn: ({ accion, comentario }: { accion: 'aprobar' | 'rechazar'; comentario: string }) => api<Ajuste>(`/ajustes/${id}/${accion}`, { metodo: 'POST', cuerpo: { comentario: comentario || undefined } }),
    onSuccess: (r, v) => onResultado({ titulo: `Ajuste #${id} ${v.accion === 'aprobar' ? 'aprobado' : 'rechazado'}`, r, nota: v.accion === 'aprobar' ? 'El stock se actualizó con el costo FIFO de las capas.' : r.motivo === 'DIFERENCIA_RECEPCION' ? 'La mercadería pasa del tránsito al destino para que el R06 la recuente.' : 'El stock no cambia.' }),
  })
  if (isPending || !a) return <Esqueleto className="h-96" />
  const bloqueo = a.estado !== 'PENDIENTE' ? `Ya está ${a.estado.toLowerCase()}.` : motivoNoAprobar(rol, usuario?.id, a.registradoPorId)
  const datos: [string, string][] = [
    ['Motivo', motivoTexto(a.motivo)],
    ['Artículo', `${a.articulo.codigo} · ${a.articulo.descripcion}`],
    ['Almacén', a.almacen.codigo + (a.almacen.tipo === 'TRANSITO' ? ' (stock en tránsito)' : '')],
    ['Cantidad', numero(a.cantidad)],
    ['Impacto', `${a.impacto.valor < 0 ? '−' : '+'}${dinero(Math.abs(a.impacto.valor))}`],
    ['Registrado por', `${a.registradoPor.codigo} · ${fecha(a.fechaRegistro)} (${antiguedad(a.antiguedadDias)})`],
  ]
  if (a.capa) datos.push(['Capa', `${a.capa.lote} · vence ${fecha(a.capa.fechaVencimiento)}`])
  if (a.ordenTraslado) datos.push(['Traslado', a.ordenTraslado.numero])
  if (a.conteo) datos.push(['Conteo', `sistema ${numero(a.conteo.cantidadSistema)}, contado ${numero(a.conteo.cantidadContada)} (${numero(a.conteo.porcentaje, 2)}%)`])
  return (
    <div className="space-y-5" data-testid="detalle-ajuste">
      <dl className="grid grid-cols-2 gap-2">
        {datos.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-superficie-2 px-3 py-2">
            <dt className="text-xs text-suave">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {a.observacion && <p className="text-sm text-suave">«{a.observacion}»</p>}
      <p className="text-sm">
        Capas afectadas: {a.impacto.capas.map((c) => `${numero(c.cantidad)} × ${numero(c.costoUnitario, 2)} (${c.lote})`).join(' + ')}
      </p>
      {!!a.alertas?.length && (
        <ul className="space-y-1 text-sm">
          {a.alertas.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <Semaforo color={x.color} compacto /> <b>{x.codigo}</b> {x.mensaje} <span className="text-suave">({x.estado.toLowerCase()})</span>
            </li>
          ))}
        </ul>
      )}
      <AccionesResolucion bloqueo={bloqueo} cargando={decidir.isPending} onAprobar={(comentario) => decidir.mutate({ accion: 'aprobar', comentario })} onRechazar={(comentario) => decidir.mutate({ accion: 'rechazar', comentario })} />
    </div>
  )
}

function DetallePromocion({ p, onResultado }: { p: Promocion; onResultado: (r: Resultado) => void }) {
  const { rol } = useUsuarioActual()
  const decidir = useMutation({
    mutationFn: ({ accion, referencia, comentario }: { accion: 'aprobar' | 'rechazar'; referencia?: string; comentario?: string }) =>
      api<Promocion>(`/promociones/${p.id}/${accion}`, { metodo: 'POST', cuerpo: accion === 'aprobar' ? { referenciaCorreo: referencia } : { comentario } }),
    onSuccess: (r, v) => onResultado({ titulo: `Promoción «${p.nombre}» ${v.accion === 'aprobar' ? 'aprobada' : 'rechazada'}`, r, nota: v.accion === 'aprobar' ? `Activa con la referencia ${r.referenciaCorreo}.` : `Queda RECHAZADA: ${r.comentarioResolucion}` }),
  })
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {p.tipo.replaceAll('_', ' ').toLowerCase()} · {p.articulo.codigo} · {p.almacen?.codigo ?? 'todos'} · {fecha(p.fechaInicio)} – {fecha(p.fechaFin)} · tope {numero(p.topeCajas)} cajas · propuesta por {p.propuestaPor?.codigo}
      </p>
      <p className="text-sm">
        Stock vendible {numero(p.vendible)} · cobertura {numero(p.coberturaDias, 1)} días para {numero(p.diasRestantes)} días de promoción
      </p>
      <AccionesResolucion bloqueo={motivoNoAprobar(rol, undefined)} cargando={decidir.isPending} pideReferencia onAprobar={(_, referencia) => decidir.mutate({ accion: 'aprobar', referencia })} onRechazar={(comentario) => decidir.mutate({ accion: 'rechazar', comentario })} />
    </div>
  )
}

function DetalleCapa({ c, onResultado }: { c: CapaListada; onResultado: (r: Resultado) => void }) {
  const { rol } = useUsuarioActual()
  const liberar = useMutation({ mutationFn: () => api<CapaListada & ConEfecto>(`/cuarentena/${c.id}/liberar`, { metodo: 'POST' }), onSuccess: (r) => onResultado({ titulo: `Capa ${c.lote} liberada`, r, nota: 'Vuelve a su ubicación de picking.' }) })
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {c.articulo.codigo} · {numero(c.cantidadRestante)} u. · costo {dinero(c.costoUnitario)} · vence {fecha(c.fechaVencimiento)} ({numero(c.vidaRestanteDias)} días) · valor {dinero(c.valor)}
      </p>
      <AccionesResolucion bloqueo={motivoNoAprobar(rol, undefined)} cargando={liberar.isPending} textoAprobar="Liberar" textoRechazar="Mantener en cuarentena" onAprobar={() => liberar.mutate()} onRechazar={() => onResultado({ titulo: `Capa ${c.lote} sigue en cuarentena`, r: {}, nota: 'Para darla de baja, el almacén registra una merma con esta capa.' })} />
    </div>
  )
}

export function Aprobaciones() {
  const [params] = useSearchParams()
  const ajustes = useAjustes('PENDIENTE')
  const promos = usePromociones()
  const capas = useCapasFiltro({ estado: 'CUARENTENA' })
  const al07 = useAlertas('codigo=AL07&estado=VIGENTE&tamano=100').data?.datos ?? []
  const [seleccion, setSeleccion] = useState<Seleccion | null>(params.get('ajuste') ? { tipo: 'ajuste', id: Number(params.get('ajuste')) } : null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const pendientes = ajustes.data ?? []
  const secciones: { clave: string; titulo: string; icono: LucideIcon; filas: { id: string; titulo: string; detalle: string; antiguedadDias?: number; valor?: number; abrir: () => void; alerta?: (typeof al07)[number] }[] }[] = [
    {
      clave: 'ajustes',
      titulo: 'Ajustes y mermas',
      icono: ClipboardCheck,
      filas: pendientes
        .filter((a) => a.motivo !== 'DIFERENCIA_RECEPCION')
        .map((a) => ({ id: `a${a.id}`, titulo: `#${a.id} · ${motivoTexto(a.motivo)} · ${a.articulo.codigo} · ${numero(a.cantidad)}`, detalle: `${a.almacen.codigo} · registrado por ${a.registradoPor.codigo}`, antiguedadDias: a.antiguedadDias, valor: a.impacto.valor, abrir: () => setSeleccion({ tipo: 'ajuste', id: a.id }), alerta: al07.find((x) => x.referenciaId === a.id) })),
    },
    {
      clave: 'diferencias',
      titulo: 'Diferencias de recepción',
      icono: PackageX,
      filas: pendientes
        .filter((a) => a.motivo === 'DIFERENCIA_RECEPCION')
        .map((a) => ({ id: `d${a.id}`, titulo: `#${a.id} · ${a.ordenTraslado?.numero} · ${a.articulo.codigo} · ${numero(a.cantidad)}`, detalle: `en tránsito hacia la planta · registrado por ${a.registradoPor.codigo}`, antiguedadDias: a.antiguedadDias, valor: a.impacto.valor, abrir: () => setSeleccion({ tipo: 'ajuste', id: a.id }), alerta: al07.find((x) => x.referenciaId === a.id) })),
    },
    {
      clave: 'promociones',
      titulo: 'Promociones propuestas',
      icono: Tag,
      filas: (promos.data ?? []).filter((p) => p.estado === 'PROPUESTA').map((p) => ({ id: `p${p.id}`, titulo: `${p.nombre} · ${p.articulo.codigo}`, detalle: `${p.tipo.replaceAll('_', ' ').toLowerCase()} · tope ${numero(p.topeCajas)} · propuesta por ${p.propuestaPor?.codigo}`, abrir: () => setSeleccion({ tipo: 'promocion', p }) })),
    },
    {
      clave: 'cuarentena',
      titulo: 'Capas en cuarentena',
      icono: ShieldAlert,
      filas: (capas.data ?? []).map((c) => ({ id: `c${c.id}`, titulo: `${c.lote} · ${c.articulo.codigo} · ${numero(c.cantidadRestante)} u.`, detalle: `${c.almacen.codigo} · ${c.vidaRestanteDias} días de vida`, valor: -c.valor, abrir: () => setSeleccion({ tipo: 'capa', c }) })),
    },
  ]
  const cargando = ajustes.isPending || promos.isPending || capas.isPending
  const titulo = seleccion?.tipo === 'ajuste' ? `Ajuste #${seleccion.id}` : seleccion?.tipo === 'promocion' ? `Promoción ${seleccion.p.nombre}` : seleccion ? `Capa ${seleccion.c.lote}` : ''
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Aprobaciones</h1>
        <p className="mt-1 text-suave">Bandeja del coordinador de logística: lo que espera una decisión de R07.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Pendientes por tipo">
        {secciones.map((s) => (
          <a key={s.clave} href={`#${s.clave}`} className="rounded-full bg-superficie px-4 py-1.5 text-sm font-semibold shadow-tarjeta" data-testid={`contador-${s.clave}`}>
            <span className="num">{s.filas.length}</span> {s.titulo.toLowerCase()}
          </a>
        ))}
      </div>
      {cargando ? (
        <Esqueleto className="h-96" />
      ) : (
        <div className="grid gap-6 2xl:grid-cols-2">
          {secciones.map(({ clave, titulo, icono: Icono, filas }) => (
            <Tarjeta key={clave} titulo={<span id={clave} className="flex items-center gap-2"><Icono aria-hidden className="size-5" /> {titulo}</span>} subtitulo={`${filas.length} pendientes`}>
              {filas.length ? (
                <ul className="space-y-2" data-testid={`bandeja-${clave}`}>
                  {filas.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={f.abrir} className="flex w-full items-center justify-between gap-3 rounded-xl border border-borde p-3 text-left text-sm transition hover:-translate-y-px hover:shadow-tarjeta" data-fila={f.id}>
                        <span>
                          <b>{f.titulo}</b>
                          <span className="block text-suave">{f.detalle}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                          {f.valor !== undefined && <span className={clsx('num font-semibold', f.valor < 0 ? 'text-rojo' : 'text-verde')}>{f.valor < 0 ? '−' : '+'}{dinero(Math.abs(f.valor))}</span>}
                          {f.antiguedadDias !== undefined && (
                            <span className={clsx('rounded-full px-2 py-0.5 font-semibold', f.alerta ? (f.alerta.color === 'ROJO' ? 'pulso-rojo bg-rojo text-white' : 'bg-amarillo-fondo text-amarillo') : 'bg-superficie-2 text-suave')} title={f.alerta ? `${f.alerta.codigo}: ${f.alerta.mensaje}` : undefined}>
                              {f.alerta && `${f.alerta.codigo} · `}
                              {antiguedad(f.antiguedadDias)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EstadoVacio titulo="Nada pendiente" />
              )}
            </Tarjeta>
          ))}
        </div>
      )}
      <PanelLateral
        abierto={!!seleccion}
        onCerrar={() => {
          setSeleccion(null)
          setResultado(null)
        }}
        titulo={titulo}
      >
        {resultado ? (
          <ResultadoOperacion titulo={resultado.titulo} detalles={resultado.r.valor !== undefined ? [['Valor', dinero(resultado.r.valor)]] : []} capas={resultado.r.capasConsumidas} costoTotal={resultado.r.costoTotal} cambioStock={resultado.nota} efecto={resultado.r.efectoAlertas} />
        ) : seleccion?.tipo === 'ajuste' ? (
          <DetalleAjuste id={seleccion.id} onResultado={setResultado} />
        ) : seleccion?.tipo === 'promocion' ? (
          <DetallePromocion p={seleccion.p} onResultado={setResultado} />
        ) : (
          seleccion?.tipo === 'capa' && <DetalleCapa c={seleccion.c} onResultado={setResultado} />
        )}
      </PanelLateral>
    </div>
  )
}
