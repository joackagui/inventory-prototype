import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/cliente'
import { useAlertas, usePropuesta, useTraslados } from '../../api/consultas'
import type { PropuestaTraslado, Traslado } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { BotonPrimario, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { fecha, numero } from '../../utils/formato'
import { type LineaRecibida, LineasRecepcion, lineasValidas } from './LineasRecepcion'
import { SelectorAlmacenOperacion, useAlmacenOperacion } from './comun'

function CrearDesdePropuesta({ p, destino, onListo }: { p: PropuestaTraslado; destino: string; onListo: (t: Traslado) => void }) {
  const [origen, setOrigen] = useState(p.origenSugerido ?? p.candidatos[0]?.almacen ?? '')
  const [cantidad, setCantidad] = useState(String(p.cantidadSugerida || p.trasladoPropuesto))
  const candidato = p.candidatos.find((c) => c.almacen === origen)
  const n = Number(cantidad)
  const crear = useMutation({ mutationFn: () => api<Traslado>('/traslados', { metodo: 'POST', cuerpo: { origen, destino, lineas: [{ articulo: p.articulo, cantidad: n }] } }), onSuccess: onListo })
  return (
    <div className="mt-2 grid items-end gap-3 rounded-xl bg-superficie-2 p-3 sm:grid-cols-[1fr_1fr_2fr_auto]" data-testid={`crear-${p.articulo}`}>
      <label className="text-sm">
        Origen
        <select className={clsx(campo, 'mt-1')} value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Origen">
          {p.candidatos.map((c) => (
            <option key={c.almacen} value={c.almacen}>
              {c.almacen}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Cantidad
        <input className={clsx(campo, 'mt-1')} type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-label="Cantidad a trasladar" />
      </label>
      <p className="text-sm" data-testid="vista-previa-traslado">
        {candidato && (
          <>
            {origen} tiene <b className="num">{numero(candidato.disponible)}</b> disponibles (ROP {numero(candidato.rop)}; puede ceder {numero(Math.max(0, candidato.excedente))} sin bajar del ROP).
            {n > candidato.excedente && <span className="block text-amarillo">Ojo: con {numero(n)} el origen quedaría bajo su ROP.</span>}
            <span className="block text-suave">
              {destino} pasaría de posición {numero(p.posicion)} a {numero(p.posicion + (n || 0))} (ROP {numero(p.rop)}, Máx {numero(p.stockMaximo)}).
            </span>
          </>
        )}
      </p>
      <BotonPrimario type="button" disabled={!(n > 0) || !origen} cargando={crear.isPending} onClick={() => crear.mutate()}>
        Emitir traslado
      </BotonPrimario>
    </div>
  )
}

const PASOS = ['Emitida', 'En tránsito', 'Recibida'] as const

function Pasos({ t }: { t: Traslado }) {
  const actual = t.estado === 'EMITIDA' ? 0 : t.estado === 'EN_TRANSITO' ? 1 : 2
  const fechas = [t.fechaEmision, t.fechaDespacho, t.fechaRecepcion]
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={`Estado: ${t.estado}`}>
      {PASOS.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          {i > 0 && <span className={clsx('h-0.5 w-6', i <= actual ? 'bg-acento' : 'bg-borde')} aria-hidden />}
          <span className={clsx('flex items-center gap-1 rounded-full px-2 py-1 font-semibold', i < actual || (i === actual && i === 2) ? 'bg-verde-fondo text-verde' : i === actual ? 'bg-acento-suave text-acento' : 'bg-superficie-2 text-suave')}>
            {(i < actual || (i === 2 && actual === 2)) && <Check aria-hidden className="size-3" />}
            {i === 2 && t.estado === 'CON_DIFERENCIA' ? 'Recibida con diferencia' : p}
            {fechas[i] && <span className="num font-normal">· {fecha(fechas[i])}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function TarjetaTraslado({ t, resaltado, onResultado }: { t: Traslado; resaltado: boolean; onResultado: (titulo: string, r: Traslado) => void }) {
  const { rol, usuario } = useAlmacenOperacion()
  const alertas = useAlertas('codigos=AL08,AL09&estado=VIGENTE&tamano=100').data?.datos.filter((a) => a.referenciaTipo === 'OrdenTraslado' && a.referenciaId === t.id) ?? []
  const esperadas = t.lineas.map((l) => ({ articulo: l.articulo.codigo, esperada: l.cantidadDespachada }))
  const [recibiendo, setRecibiendo] = useState(false)
  const [lineas, setLineas] = useState<LineaRecibida[]>(esperadas.map((e) => ({ articulo: e.articulo, cantidadRecibida: String(e.esperada), estado: 'CONFORME' })))
  const despachar = useMutation({ mutationFn: () => api<Traslado>(`/traslados/${t.id}/despachar`, { metodo: 'POST' }), onSuccess: (r) => onResultado(`Traslado ${t.numero} despachado al tránsito`, r) })
  const recibir = useMutation({
    mutationFn: () => api<Traslado>(`/traslados/${t.id}/recibir`, { metodo: 'POST', cuerpo: { lineas: lineas.map((l) => ({ articulo: l.articulo, cantidadRecibida: Number(l.cantidadRecibida), estado: l.estado })) } }),
    onSuccess: (r) => {
      setRecibiendo(false)
      onResultado(`Traslado ${t.numero} recibido${r.estado === 'CON_DIFERENCIA' ? ' con diferencia' : ''}`, r)
    },
  })
  const esMio = (codigo: string) => rol === 'R07' || (rol === 'R06' && usuario?.almacen?.codigo === codigo)
  useEffect(() => {
    if (resaltado) document.getElementById(`traslado-${t.id}`)?.scrollIntoView({ block: 'center' })
  }, [resaltado, t.id])
  return (
    <li id={`traslado-${t.id}`} className={clsx('rounded-xl border bg-superficie p-4', resaltado ? 'border-acento ring-2 ring-acento' : 'border-borde')} data-traslado={t.numero}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          {t.numero} · {t.origen.codigo} → {t.destino.codigo}
          <span className="block text-sm font-normal text-suave">{t.lineas.map((l) => `${l.articulo.codigo}: ${numero(l.cantidadDespachada)}${l.cantidadRecibida !== null ? ` (recibido ${numero(l.cantidadRecibida)})` : ''}`).join(' · ')}</span>
        </p>
        <Pasos t={t} />
      </div>
      {alertas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {alertas.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <Semaforo color={a.color} compacto /> <b>{a.codigo}</b> {a.mensaje}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        {t.estado === 'EMITIDA' && esMio(t.origen.codigo) && (
          <BotonPrimario type="button" cargando={despachar.isPending} onClick={() => despachar.mutate()}>
            Despachar desde {t.origen.codigo}
          </BotonPrimario>
        )}
        {t.estado === 'EN_TRANSITO' && esMio(t.destino.codigo) && !recibiendo && (
          <BotonPrimario type="button" onClick={() => setRecibiendo(true)}>
            Recibir en {t.destino.codigo}
          </BotonPrimario>
        )}
      </div>
      {recibiendo && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            recibir.mutate()
          }}
        >
          <LineasRecepcion esperadas={esperadas} valor={lineas} onCambiar={setLineas} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRecibiendo(false)} className="rounded-lg border border-borde px-4 py-2">
              Cancelar
            </button>
            <BotonPrimario type="submit" disabled={!lineasValidas(esperadas, lineas)} cargando={recibir.isPending}>
              Confirmar recepción
            </BotonPrimario>
          </div>
        </form>
      )}
    </li>
  )
}

// Traslados extraordinarios para una fiesta: llegan desde Fiestas con la brecha de cada artículo (?extraordinario=ART:cant,...).
function Extraordinarios({ destino, lineas, onListo }: { destino: string; lineas: { articulo: string; cantidad: number }[]; onListo: (t: Traslado) => void }) {
  const { almacenes } = useAlmacenOperacion()
  const origenes = almacenes.filter((a) => a.codigo !== destino)
  const [valores, setValores] = useState(lineas.map((l) => ({ ...l, origen: origenes[0]?.codigo ?? '', cantidad: String(l.cantidad), hecho: false })))
  const emitir = useMutation({
    mutationFn: (i: number) => api<Traslado>('/traslados', { metodo: 'POST', cuerpo: { origen: valores[i].origen || origenes[0]?.codigo, destino, lineas: [{ articulo: valores[i].articulo, cantidad: Number(valores[i].cantidad) }] } }),
    onSuccess: (t, i) => {
      setValores(valores.map((v, j) => (j === i ? { ...v, hecho: true } : v)))
      onListo(t)
    },
  })
  return (
    <Tarjeta titulo="Traslados extraordinarios para la fiesta" subtitulo={`Hacia ${destino}: la cantidad propuesta es la brecha (pronóstico − posición); emite uno por artículo`}>
      <ul className="space-y-2" data-testid="extraordinarios">
        {valores.map((v, i) => (
          <li key={v.articulo} className="grid items-end gap-3 rounded-xl bg-superficie-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]" data-articulo={v.articulo}>
            <p className="font-semibold">{v.articulo}</p>
            <label className="text-sm">
              Origen
              <select className={clsx(campo, 'mt-1')} value={v.origen} onChange={(e) => setValores(valores.map((x, j) => (j === i ? { ...x, origen: e.target.value } : x)))} aria-label={`Origen ${v.articulo}`}>
                {origenes.map((o) => (
                  <option key={o.codigo} value={o.codigo}>
                    {o.codigo}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Cantidad
              <input className={clsx(campo, 'mt-1')} type="number" min={1} value={v.cantidad} onChange={(e) => setValores(valores.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} aria-label={`Cantidad ${v.articulo}`} />
            </label>
            {v.hecho ? (
              <span className="pb-2 text-sm font-semibold text-verde">Emitido ✓</span>
            ) : (
              <BotonPrimario type="button" disabled={!(Number(v.cantidad) > 0)} cargando={emitir.isPending && emitir.variables === i} onClick={() => emitir.mutate(i)}>
                Emitir
              </BotonPrimario>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

export function Traslados() {
  const { fijo, inicial, rol } = useAlmacenOperacion()
  const [params] = useSearchParams()
  const [vista, setVista] = useState<'propuestas' | 'seguimiento'>(params.get('id') || rol === 'R06' ? 'seguimiento' : 'propuestas')
  const [destino, setDestino] = useState(inicial)
  const [creando, setCreando] = useState<string | null>(params.get('articulo'))
  const [resultado, setResultado] = useState<{ titulo: string; r: Traslado } | null>(null)
  const propuesta = usePropuesta(vista === 'propuestas' ? (fijo ?? destino) : undefined)
  const traslados = useTraslados()
  const resaltado = Number(params.get('id'))
  const extraordinarios = (params.get('extraordinario') ?? '')
    .split(',')
    .filter(Boolean)
    .map((x) => ({ articulo: x.split(':')[0], cantidad: Number(x.split(':')[1]) }))
  return (
    <div className="space-y-6">
      {rol === 'R07' && extraordinarios.length > 0 && <Extraordinarios destino={inicial} lineas={extraordinarios} onListo={(t) => setResultado({ titulo: `Traslado ${t.numero} emitido`, r: t })} />}
      <div role="tablist" className="flex gap-1 border-b border-borde">
        {(['propuestas', 'seguimiento'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={clsx('-mb-px border-b-2 px-4 py-2 font-semibold', vista === v ? 'border-acento text-acento' : 'border-transparent text-suave')}>
            {v === 'propuestas' ? 'Propuestas' : 'Seguimiento'}
          </button>
        ))}
      </div>
      {resultado && (
        <ResultadoOperacion
          titulo={resultado.titulo}
          detalles={[
            ['Estado', resultado.r.estado.replaceAll('_', ' ').toLowerCase()],
            ['Ruta', `${resultado.r.origen.codigo} → ${resultado.r.destino.codigo}`],
          ]}
          capas={resultado.r.capasConsumidas}
          costoTotal={resultado.r.costoTotal}
          cambioStock={resultado.r.estado === 'EN_TRANSITO' ? 'Las capas pasan al tránsito del destino conservando lote, costo y vencimiento.' : resultado.r.estado === 'CON_DIFERENCIA' ? 'La diferencia sigue en el tránsito como ajuste pendiente para R07 (ver Aprobaciones).' : undefined}
          efecto={resultado.r.efectoAlertas}
        />
      )}
      {vista === 'propuestas' ? (
        <Tarjeta titulo="Propuestas de traslado" subtitulo="Por artículo con posición ≤ ROP: traslado = Máx − posición, desde el almacén con más cobertura sobre su ROP" acciones={<SelectorAlmacenOperacion valor={destino} onCambiar={setDestino} fijo={fijo} etiqueta="Almacén destino" />}>
          {propuesta.isPending ? (
            <Esqueleto className="h-48" />
          ) : !propuesta.data?.length ? (
            <EstadoVacio titulo="Sin traslados propuestos">Todos los artículos están por encima de su ROP en este almacén.</EstadoVacio>
          ) : (
            <ul className="space-y-3" data-testid="propuestas">
              {propuesta.data.map((p) => (
                <li key={p.articulo} className="rounded-xl border border-borde p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>
                      <b>{p.articulo}</b> <span className="text-suave">{p.descripcion}</span>
                      <span className="num block text-sm">
                        Posición {numero(p.posicion)} · ROP {numero(p.rop)} · Máx {numero(p.stockMaximo)} · propuesto <b>{numero(p.trasladoPropuesto)}</b> · origen sugerido <b>{p.origenSugerido ?? '—'}</b> ({numero(p.cantidadSugerida)})
                      </span>
                      <span className="block text-xs text-suave">Cobertura sobre ROP: {p.candidatos.map((c) => `${c.almacen} ${numero(c.coberturaSobreRop, 1)} días`).join(' · ')}</span>
                    </p>
                    {rol === 'R07' && creando !== p.articulo && (
                      <button type="button" onClick={() => setCreando(p.articulo)} className="rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-marca-texto">
                        Crear traslado
                      </button>
                    )}
                  </div>
                  {rol === 'R07' && creando === p.articulo && (
                    <CrearDesdePropuesta
                      p={p}
                      destino={fijo ?? destino}
                      onListo={(t) => {
                        setCreando(null)
                        setResultado({ titulo: `Traslado ${t.numero} emitido`, r: t })
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Seguimiento de traslados" subtitulo="Emitida → En tránsito → Recibida; con sus alertas AL08 y AL09">
          <Regla>Despacha el R06 del origen y recibe el R06 del destino. Una diferencia queda como ajuste pendiente sobre el stock en tránsito: lo decide R07.</Regla>
          {traslados.isPending ? (
            <Esqueleto className="mt-4 h-48" />
          ) : (
            <ul className="mt-4 space-y-3" data-testid="seguimiento">
              {traslados.data?.map((t) => (
                <TarjetaTraslado key={t.id} t={t} resaltado={t.id === resaltado} onResultado={(titulo, r) => setResultado({ titulo, r })} />
              ))}
            </ul>
          )}
        </Tarjeta>
      )}
    </div>
  )
}
