import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { CalendarDays, CircleCheck, CircleX, LogIn, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, ErrorApi } from '../../api/cliente'
import { useBitacora, useConfiguracion, useEscenarios, useEventosIntegracion, useFecha, usePermisosUsuarios, useUsuarioActual } from '../../api/consultas'
import type { CambioFecha, ConEfecto, EventoIntegracion, Integridad } from '../../api/tipos'
import { DialogoRestablecer } from '../../componentes/DialogoRestablecer'
import { EstadoVacio } from '../../componentes/Estados'
import { BotonPrimario, campo } from '../../componentes/Formulario'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { fecha, numero } from '../../utils/formato'

type RespuestaFecha = CambioFecha & ConEfecto & { escenario?: string }
const cambios = (r: ConEfecto) => (r.efectoAlertas ? r.efectoAlertas.creadas.length + r.efectoAlertas.resueltas.length + r.efectoAlertas.cambiadas.length : 0)

function TablaIntegridad({ r }: { r: Integridad }) {
  return (
    <table className="w-full text-sm" data-testid="tabla-integridad">
      <thead>
        <tr className="text-left text-xs font-semibold text-suave">
          <th scope="col" className="pb-2">
            Comprobación
          </th>
          <th scope="col" className="pb-2 text-right">
            Registros revisados
          </th>
          <th scope="col" className="pb-2 text-right">
            Tiempo
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-borde">
        {r.comprobaciones.map((c) => (
          <tr key={c.nombre} data-comprobacion={c.nombre} data-ok={c.ok}>
            <td className="py-2">
              <span className="flex items-center gap-2 font-medium">
                {c.ok ? <CircleCheck aria-label="Correcto" className="size-5 text-verde" /> : <CircleX aria-label="Con errores" className="size-5 text-rojo" />}
                {c.nombre}
              </span>
              {c.excepciones.length > 0 && <ul className="mt-1 ml-7 list-disc text-xs text-rojo">{c.excepciones.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>}
            </td>
            <td className="num text-right">{numero(c.revisados)}</td>
            <td className="num text-right">{numero(c.ms)} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Administracion() {
  const { rol } = useUsuarioActual()
  const { fijarUsuario } = useSesion()
  const navegar = useNavigate()
  const opera = rol === 'R07' || rol === 'R09'
  const { data: hoy } = useFecha()
  const escenarios = useEscenarios()
  const permisos = usePermisosUsuarios()
  const eventos = useEventosIntegracion(opera)
  const bitacora = useBitacora(opera)
  const config = useConfiguracion()
  const [ultimo, setUltimo] = useState<{ titulo: string; r: RespuestaFecha } | null>(null)
  const [restableciendo, setRestableciendo] = useState(false)
  const [filtro, setFiltro] = useState({ usuario: '', entidad: '', fecha: '' })
  const [editando, setEditando] = useState<Record<string, string>>({})

  const fechaMut = useMutation({
    mutationFn: (p: { titulo: string; ruta: string; metodo: 'POST' | 'PUT'; cuerpo?: object }) => api<RespuestaFecha>(p.ruta, { metodo: p.metodo, cuerpo: p.cuerpo }),
    onSuccess: (r, p) => {
      setUltimo({ titulo: p.titulo, r })
      toast.success(`${p.titulo}: ${fecha(r.fechaSimulada)}`, { description: `${cambios(r)} alertas cambiaron` })
    },
  })
  const restablecer = useMutation({
    mutationFn: () => api<{ fechaSimulada: string; alertasVigentes: number; segundos: number; integridad: Integridad }>('/simulacion/restablecer-datos', { metodo: 'POST', cuerpo: { confirmacion: 'RESTABLECER' } }),
    onSuccess: (r) => {
      setRestableciendo(false)
      toast.success('Datos de la demo restablecidos', { description: `${fecha(r.fechaSimulada)} · ${r.alertasVigentes} alertas vigentes · ${r.segundos} s` })
    },
  })
  const integridad = useMutation({ mutationFn: () => api<Integridad>('/integridad') })
  const falla = useMutation({ mutationFn: (estado: 'REINTENTO' | 'COLA_ERRORES') => api<EventoIntegracion>('/simulacion/falla-integracion', { metodo: 'POST', cuerpo: { estado } }), onSuccess: (e) => toast.warning(`Evento ${e.referencia} en ${e.estado === 'REINTENTO' ? 'reintento' : 'cola de errores'}: AL16 creada`) })
  const reprocesar = useMutation({ mutationFn: (id: number) => api(`/integracion/eventos/${id}/reprocesar`, { metodo: 'POST' }), onSuccess: () => toast.success('Evento reprocesado: AL16 resuelta') })
  const sinStock = useMutation({
    meta: { silencioso: true },
    mutationFn: () => api('/pedidos', { metodo: 'POST', cuerpo: { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10048', cantidad: 30 }] } }),
    onError: (e) => {
      const numeroPedido = e instanceof ErrorApi ? (e.detalles as { numero?: string } | null)?.numero : undefined
      toast.info(`Pedido ${numeroPedido ?? ''} pendiente de revisión por falta de stock`, { description: 'AL11 aparece cuando pasan más de 2 h: avanza la fecha 1 día.' })
    },
  })
  const guardarConfig = useMutation({ mutationFn: ({ clave, valor }: { clave: string; valor: number }) => api(`/configuracion/${clave}`, { metodo: 'PUT', cuerpo: { valor } }), onSuccess: (_, v) => (setEditando({ ...editando, [v.clave]: '' }), toast.success(`${v.clave} actualizado`)) })

  const mover = (dias: number) => fechaMut.mutate({ titulo: dias > 0 ? `Avanzar ${dias} días` : `Retroceder ${-dias} días`, ruta: '/simulacion/avanzar', metodo: 'POST', cuerpo: { dias } })
  const filas = (bitacora.data ?? []).filter((b) => (!filtro.usuario || b.usuario?.codigo === filtro.usuario) && (!filtro.entidad || b.entidad === filtro.entidad) && (!filtro.fecha || b.fechaOperacion?.startsWith(filtro.fecha)))
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Administración de la demo</h1>
        <p className="secundario mt-1 text-suave">Herramientas para ensayar y conducir la demo en vivo{opera ? '' : ' (solo lectura para tu rol)'}.</p>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Tarjeta titulo="Reloj simulado" subtitulo="Toda la app usa esta fecha; las alertas se reevalúan al cambiarla">
          <p className="flex items-center gap-3">
            <CalendarDays aria-hidden className="size-8 text-acento" />
            <span className="num text-5xl font-bold tracking-tight" data-testid="fecha-grande">
              {fecha(hoy?.fechaSimulada)}
            </span>
          </p>
          {opera && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[-7, -1, 1, 7, 30].map((d) => (
                <button key={d} type="button" disabled={fechaMut.isPending} onClick={() => mover(d)} className="rounded-lg border border-borde px-3 py-1.5 font-semibold disabled:opacity-50">
                  {d > 0 ? `+${d}` : `−${-d}`} {Math.abs(d) === 1 ? 'día' : 'días'}
                </button>
              ))}
              <button type="button" disabled={fechaMut.isPending} onClick={() => fechaMut.mutate({ titulo: 'Fecha restablecida', ruta: '/simulacion/restablecer', metodo: 'POST' })} className="inline-flex items-center gap-1 rounded-lg border border-borde px-3 py-1.5 font-semibold">
                <RotateCcw aria-hidden className="size-4" /> 30/06/2027
              </button>
            </div>
          )}
          <h3 className="mt-6 mb-2 font-semibold">Escenarios de demo</h3>
          <ul className="space-y-2" data-testid="escenarios">
            {escenarios.data?.map((e) => (
              <li key={e.nombre} className="flex items-center justify-between gap-3 rounded-xl border border-borde p-3 text-sm">
                <span>
                  <b>{e.nombre.replaceAll('-', ' ')}</b> <span className="num text-suave">· {fecha(e.fecha)}</span>
                  <span className="block text-suave">{e.descripcion}</span>
                </span>
                {opera && (
                  <button type="button" disabled={fechaMut.isPending} onClick={() => fechaMut.mutate({ titulo: `Escenario «${e.nombre}»`, ruta: '/simulacion/escenario', metodo: 'POST', cuerpo: { nombre: e.nombre } })} className="shrink-0 rounded-lg bg-marca px-3 py-1.5 font-semibold text-marca-texto" data-escenario={e.nombre}>
                    Aplicar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {ultimo && (
            <p className="mt-3 rounded-lg bg-acento-suave p-3 text-sm" data-testid="resultado-fecha" aria-live="polite">
              <b>{ultimo.titulo}</b> → {fecha(ultimo.r.fechaSimulada)}: {cambios(ultimo.r)} alertas cambiaron ({ultimo.r.efectoAlertas?.creadas.length} nuevas, {ultimo.r.efectoAlertas?.resueltas.length} resueltas, {ultimo.r.efectoAlertas?.cambiadas.length} de color).
              {ultimo.r.efectoAlertas?.cambiadas.slice(0, 4).map((a) => (
                <span key={a.id} className="block text-xs">
                  {a.codigo} {a.articulo} {a.almacen}: {a.colorAntes?.toLowerCase()} → {a.colorDespues?.toLowerCase()}
                </span>
              ))}
            </p>
          )}
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta titulo="Datos de la demo" subtitulo="Acción de ensayo: vuelve al estado base del 30/06/2027">
            <p className="text-sm">Borra lo hecho en la demo y siembra otra vez el escenario determinista (19 alertas). Requiere DEMO_MODE=true en el backend y escribir RESTABLECER.</p>
            {opera && (
              <BotonPrimario type="button" className="mt-3 bg-rojo text-sobre-color hover:bg-rojo" onClick={() => setRestableciendo(true)}>
                Restablecer datos
              </BotonPrimario>
            )}
            {restablecer.data && (
              <div className="mt-4 space-y-2" data-testid="resultado-restablecer">
                <p className="text-sm font-semibold text-verde">
                  Listo en {restablecer.data.segundos} s: {fecha(restablecer.data.fechaSimulada)}, {restablecer.data.alertasVigentes} alertas vigentes.
                </p>
                <TablaIntegridad r={restablecer.data.integridad} />
              </div>
            )}
          </Tarjeta>
          <Tarjeta titulo="Simular fallas" subtitulo="Para mostrar AL16 (integración) y AL11 (pedido pendiente)">
            {opera ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => falla.mutate('REINTENTO')} className="rounded-lg border-2 border-amarillo px-3 py-1.5 font-semibold text-amarillo">
                    Evento en reintento
                  </button>
                  <button type="button" onClick={() => falla.mutate('COLA_ERRORES')} className="rounded-lg border-2 border-rojo px-3 py-1.5 font-semibold text-rojo">
                    Evento en cola de errores
                  </button>
                  {rol === 'R07' && (
                    <button type="button" onClick={() => sinStock.mutate()} disabled={sinStock.isPending} className="rounded-lg border border-borde px-3 py-1.5 font-semibold">
                      Pedido sin stock (AL11)
                    </button>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-sm" data-testid="eventos">
                  {eventos.data?.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-superficie-2 px-3 py-1.5">
                      <span>
                        <b>{e.referencia}</b> · {e.tipo} · {e.estado.replace('_', ' ').toLowerCase()} · {e.intentos} intentos
                      </span>
                      {rol === 'R09' && e.estado !== 'PROCESADO' && (
                        <button type="button" onClick={() => reprocesar.mutate(e.id)} className="rounded-md bg-marca px-2 py-1 text-xs font-semibold text-marca-texto">
                          Reprocesar
                        </button>
                      )}
                    </li>
                  ))}
                  {!eventos.data?.length && <li className="text-suave">Sin eventos de integración.</li>}
                </ul>
              </>
            ) : (
              <p className="text-sm text-suave">Solo R07 y R09 simulan fallas.</p>
            )}
          </Tarjeta>
        </div>
      </div>

      {opera && (
        <Tarjeta titulo="Verificación de integridad" subtitulo="Capas, movimientos, lotes, trigger de inmutabilidad y reservas" acciones={<BotonPrimario type="button" cargando={integridad.isPending} onClick={() => integridad.mutate()}>Verificar integridad</BotonPrimario>}>
          {integridad.data ? <TablaIntegridad r={integridad.data} /> : <p className="text-sm text-suave">Pulsa «Verificar integridad» para ver cada comprobación.</p>}
        </Tarjeta>
      )}

      <Tarjeta titulo="Usuarios y roles" subtitulo="Usuarios genéricos sin contraseña: el backend valida el rol de cada petición">
        {permisos.isPending ? (
          <Esqueleto className="h-48" />
        ) : (
          <table className="w-full text-sm" data-testid="tabla-usuarios">
            <thead>
              <tr className="text-left text-xs font-semibold text-suave">
                {['Usuario', 'Rol', 'Almacén', 'Puede', ''].map((t) => (
                  <th key={t} scope="col" className="pb-2">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {permisos.data?.map((u) => (
                <tr key={u.codigo} className="align-top">
                  <td className="py-2">
                    <b>{u.codigo}</b>
                    <span className="block text-suave">{u.nombre}</span>
                  </td>
                  <td>
                    {u.rol} · {u.rolNombre}
                  </td>
                  <td>{u.almacen ?? 'Los 3'}</td>
                  <td>
                    <ul className="list-disc pl-4 text-suave">
                      {u.permisos.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        fijarUsuario(u.codigo)
                        toast.success(`Ahora operas como ${u.codigo}`)
                        navegar('/tablero')
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-borde px-2.5 py-1.5 font-semibold whitespace-nowrap"
                    >
                      <LogIn aria-hidden className="size-4" /> Entrar como
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>

      {opera && (
        <Tarjeta
          titulo="Bitácora de cambios"
          subtitulo="Parámetros, umbrales, configuración, fecha simulada y restablecimientos"
          acciones={
            <span className="flex flex-wrap gap-2">
              <select className={campo} value={filtro.usuario} onChange={(e) => setFiltro({ ...filtro, usuario: e.target.value })} aria-label="Filtrar por usuario">
                <option value="">Todos los usuarios</option>
                {[...new Set(bitacora.data?.map((b) => b.usuario?.codigo).filter(Boolean))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className={campo} value={filtro.entidad} onChange={(e) => setFiltro({ ...filtro, entidad: e.target.value })} aria-label="Filtrar por tipo">
                <option value="">Todos los tipos</option>
                {[...new Set(bitacora.data?.map((b) => b.entidad))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input type="date" className={campo} value={filtro.fecha} onChange={(e) => setFiltro({ ...filtro, fecha: e.target.value })} aria-label="Filtrar por fecha" />
            </span>
          }
        >
          {!filas.length ? (
            <EstadoVacio titulo="Sin cambios registrados" />
          ) : (
            <table className="w-full text-sm" data-testid="bitacora">
              <thead>
                <tr className="text-left text-xs font-semibold text-suave">
                  {['Fecha simulada', 'Usuario', 'Tipo', 'Registro', 'Antes', 'Después'].map((t) => (
                    <th key={t} scope="col" className="pb-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="num py-2">{fecha(b.fechaOperacion)}</td>
                    <td>{b.usuario?.codigo ?? '—'}</td>
                    <td>{b.entidad}</td>
                    <td>
                      {b.entidadId} · {b.campo}
                    </td>
                    <td className="max-w-64 truncate font-mono text-xs text-suave" title={JSON.stringify(b.valorAnterior)}>
                      {JSON.stringify(b.valorAnterior) ?? '—'}
                    </td>
                    <td className="max-w-64 truncate font-mono text-xs" title={JSON.stringify(b.valorNuevo)}>
                      {JSON.stringify(b.valorNuevo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Configuración" subtitulo={rol === 'R07' ? 'Edita los valores numéricos; los umbrales se editan en el Centro de alertas y la fecha, arriba' : 'Solo lectura'}>
        <table className="w-full text-sm" data-testid="configuracion">
          <tbody className="divide-y divide-borde">
            {config.data?.map((c) => {
              const numerico = typeof c.valor === 'number' && c.clave !== 'fechaSimulada'
              return (
                <tr key={c.clave}>
                  <td className="py-2">
                    <b>{c.clave}</b>
                    <span className="block text-suave">{c.descripcion}</span>
                  </td>
                  <td className="text-right">
                    {numerico && rol === 'R07' ? (
                      <span className="inline-flex items-center gap-2">
                        <input className={clsx(campo, 'w-28')} type="number" step="any" min={0} value={editando[c.clave] || String(c.valor)} onChange={(e) => setEditando({ ...editando, [c.clave]: e.target.value })} aria-label={c.clave} />
                        <button type="button" disabled={!editando[c.clave] || Number(editando[c.clave]) === c.valor} onClick={() => guardarConfig.mutate({ clave: c.clave, valor: Number(editando[c.clave]) })} className="rounded-lg bg-marca px-3 py-1.5 font-semibold text-marca-texto disabled:opacity-40">
                          Guardar
                        </button>
                      </span>
                    ) : (
                      <span className="num font-mono text-xs">{typeof c.valor === 'object' ? 'JSON (ver Centro de alertas › Umbrales)' : String(c.valor)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Tarjeta>
      <DialogoRestablecer abierto={restableciendo} onCerrar={() => setRestableciendo(false)} onConfirmar={() => restablecer.mutate()} cargando={restablecer.isPending} />
    </div>
  )
}
