import clsx from 'clsx'
import { ArrowLeft, ClipboardList, PackagePlus, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAlertas, useAlmacenes, useCapas, useMovimientosArticulo, useResumenArticulo, useUsuarioActual } from '../../api/consultas'
import type { Rol } from '../../api/tipos'
import { EstadoError, EstadoVacio } from '../../componentes/Estados'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { antiguedad, dinero, fecha, numero } from '../../utils/formato'
import { SeccionCapas } from './SeccionCapas'
import { SeccionKardex } from './SeccionKardex'
import { SeccionParametros } from './SeccionParametros'
import { SeccionPosicion } from './SeccionPosicion'

const SECCIONES = [
  { id: 'posicion', titulo: 'Posición de stock' },
  { id: 'parametros', titulo: 'Parámetros' },
  { id: 'capas', titulo: 'Capas FIFO' },
  { id: 'kardex', titulo: 'Kardex' },
  { id: 'recientes', titulo: 'Alertas y movimientos' },
]

// Acciones rápidas: enlazan a /operaciones con la acción y el artículo en la URL (pantalla del siguiente paso).
const ACCIONES: { accion: string; texto: string; icono: typeof Truck; roles: Rol[] }[] = [
  { accion: 'recepcion', texto: 'Registrar recepción', icono: PackagePlus, roles: ['R06', 'R07'] },
  { accion: 'traslado', texto: 'Proponer traslado', icono: Truck, roles: ['R07'] },
  { accion: 'conteo', texto: 'Registrar conteo', icono: ClipboardList, roles: ['R06', 'R07'] },
  { accion: 'pedido', texto: 'Crear pedido', icono: ShoppingCart, roles: ['R01'] },
]

export function Ficha() {
  const { codigo = '' } = useParams()
  const { almacen } = useSesion()
  const { rol, usuario } = useUsuarioActual()
  const { data: almacenes = [] } = useAlmacenes()
  const resumen = useResumenArticulo(codigo, almacen)
  const completo = !!rol && rol !== 'R01'
  const capas = useCapas(codigo, completo)
  const alertas = useAlertas(`articulo=${codigo}&orden=gravedad&tamano=20${almacen === 'TODOS' ? '' : `&almacen=${almacen}`}`, completo)
  const movimientos = useMovimientosArticulo(codigo, almacen, completo)
  const [almacenKardex, setAlmacenKardex] = useState('')

  if (resumen.isPending || !rol) return <Esqueleto className="h-[36rem]" />
  if (resumen.isError) return <EstadoError error={resumen.error} reintentar={() => resumen.refetch()} />
  const { articulo, almacenes: filas } = resumen.data
  const visibles = almacenes.filter((a) => filas.some((f) => f.almacen === a.codigo))
  const kardexEn = almacenKardex || (almacen !== 'TODOS' ? almacen : (usuario?.almacen?.codigo ?? visibles[0]?.codigo ?? 'CD-LP-01'))
  const almacenAccion = almacen !== 'TODOS' ? almacen : (usuario?.almacen?.codigo ?? '')

  return (
    <div className="space-y-6">
      <Link to="/articulos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acento hover:underline">
        <ArrowLeft aria-hidden className="size-4" /> Artículos
      </Link>

      <section className="entrar flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-borde bg-superficie p-6 shadow-tarjeta" aria-label="Cabecera del artículo">
        <div>
          <p className="num text-sm font-semibold text-suave">{articulo.codigo}</p>
          <h1 className="text-3xl font-bold tracking-tight">{articulo.descripcion}</h1>
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            {completo && filas[0]?.parametros && <span className="rounded-md bg-marca px-2.5 py-1 font-bold text-marca-texto">Clase {filas[0].parametros.claseAbc}</span>}
            <span className="rounded-md bg-superficie-2 px-2.5 py-1 font-semibold">{articulo.familia}</span>
            <span className="rounded-md bg-superficie-2 px-2.5 py-1 font-semibold">{articulo.unidad}</span>
            {articulo.esRetornable && <span className="rounded-md bg-verde-fondo px-2.5 py-1 font-semibold text-verde">Retornable</span>}
          </p>
        </div>
        {completo && (
          <dl className="grid grid-cols-3 gap-6">
            <div>
              <dt className="text-sm text-suave">Precio de lista</dt>
              <dd className="num text-xl font-bold">{dinero(articulo.precio)}</dd>
            </div>
            <div>
              <dt className="text-sm text-suave">Vida útil</dt>
              <dd className="num text-xl font-bold">{numero(articulo.vidaUtilDias)} días</dd>
            </div>
            <div>
              <dt className="text-sm text-suave">Costo FIFO vigente</dt>
              <dd className="num text-xl font-bold" data-testid="costo-fifo">
                {dinero(filas[0]?.costoFifoMasAntigua)}
              </dd>
              <dd className="text-xs text-suave">capa más antigua · {filas[0]?.nombre}</dd>
            </div>
          </dl>
        )}
        <div className="flex w-full flex-wrap gap-2">
          {ACCIONES.filter((a) => a.roles.includes(rol)).map(({ accion, texto, icono: Icono }) => (
            <Link key={accion} to={`/operaciones?accion=${accion}&articulo=${articulo.codigo}${almacenAccion ? `&almacen=${almacenAccion}` : ''}`} className="inline-flex items-center gap-2 rounded-xl border border-borde px-3.5 py-2 text-sm font-semibold hover:bg-superficie-2">
              <Icono aria-hidden className="size-4" /> {texto}
            </Link>
          ))}
        </div>
      </section>

      {!completo ? (
        <Tarjeta titulo="Disponibilidad">
          <ul className="grid gap-3 sm:grid-cols-3" data-testid="disponibilidad">
            {filas.map((f) => (
              <li key={f.almacen} className={clsx('rounded-xl p-4', f.estado === 'DISPONIBLE' ? 'bg-verde-fondo text-verde' : 'bg-rojo-fondo text-rojo')}>
                <p className="font-semibold">{f.nombre}</p>
                <p className="text-2xl font-bold">{f.estado === 'DISPONIBLE' ? 'Disponible' : 'Agotado'}</p>
                {f.estado === 'DISPONIBLE' && <p className="num">{numero(f.disponible)} para vender</p>}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : (
        <>
          <nav aria-label="Secciones de la ficha" className="sticky top-[4.25rem] z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-borde bg-superficie/90 p-1 backdrop-blur">
            {SECCIONES.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-suave hover:bg-superficie-2 hover:text-texto">
                {s.titulo}
              </a>
            ))}
          </nav>
          <section id="posicion" className="scroll-mt-32">
            <h2 className="mb-3 text-xl font-semibold">Posición de stock</h2>
            <SeccionPosicion almacenes={filas} />
          </section>
          <section id="parametros" className="scroll-mt-32">
            <Tarjeta titulo="Parámetros de reposición" subtitulo={rol === 'R07' ? 'Puedes editarlos con vista previa en vivo' : 'Solo lectura para tu rol'}>
              <SeccionParametros codigo={articulo.codigo} almacenes={filas} editable={rol === 'R07'} />
            </Tarjeta>
          </section>
          <section id="capas" className="scroll-mt-32">
            <Tarjeta titulo="Capas FIFO" subtitulo="Se despacha primero la capa más antigua con al menos 15 días de vida; las capas en cuarentena o por vencer no salen">
              {capas.isPending ? <Esqueleto className="h-64" /> : capas.isError ? <EstadoError error={capas.error} /> : <SeccionCapas capas={capas.data} almacenes={visibles} vidaUtil={articulo.vidaUtilDias!} />}
            </Tarjeta>
          </section>
          <section id="kardex" className="scroll-mt-32">
            <Tarjeta
              titulo="Kardex valorado"
              subtitulo="Saldo acumulado en cantidad y valor; los movimientos de control (reservas, conteos, envases) aparecen en gris"
              acciones={
                <div role="radiogroup" aria-label="Almacén del kardex" className="inline-flex rounded-lg border border-borde p-0.5">
                  {visibles.map((a) => (
                    <button key={a.codigo} role="radio" aria-checked={kardexEn === a.codigo} onClick={() => setAlmacenKardex(a.codigo)} className={clsx('rounded-md px-2.5 py-1 text-sm font-semibold', kardexEn === a.codigo ? 'bg-acento-suave text-acento' : 'text-suave')}>
                      {a.corto}
                    </button>
                  ))}
                </div>
              }
            >
              <SeccionKardex key={kardexEn} codigo={articulo.codigo} almacen={kardexEn} />
            </Tarjeta>
          </section>
          <section id="recientes" className="grid scroll-mt-32 gap-6 2xl:grid-cols-2">
            <Tarjeta titulo="Alertas del artículo">
              {alertas.data?.datos.length ? (
                <ul className="space-y-2">
                  {alertas.data.datos.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 rounded-xl border border-borde p-3 text-sm">
                      <Semaforo color={a.color} compacto />
                      <span>
                        <b>
                          {a.codigo} · {a.nombre}
                        </b>{' '}
                        <span className="text-suave">
                          {a.almacen?.codigo} · {antiguedad(a.antiguedadDias)}
                        </span>
                        <span className="block">{a.mensaje}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EstadoVacio titulo="Sin alertas vigentes" />
              )}
            </Tarjeta>
            <Tarjeta titulo="Movimientos recientes">
              {movimientos.data?.datos.length ? (
                <ul className="divide-y divide-borde text-sm">
                  {movimientos.data.datos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="num text-suave">{fecha(m.fechaOperacion)}</span> · <b>{m.tipo.replaceAll('_', ' ').toLowerCase()}</b> · {m.almacen.codigo}
                        <span className="block text-suave">{m.motivo}</span>
                      </span>
                      <span className={clsx('num font-semibold', m.cantidad < 0 ? 'text-rojo' : 'text-verde')}>{m.cantidad > 0 ? `+${numero(m.cantidad)}` : numero(m.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EstadoVacio titulo="Sin movimientos" />
              )}
            </Tarjeta>
          </section>
        </>
      )}
    </div>
  )
}
