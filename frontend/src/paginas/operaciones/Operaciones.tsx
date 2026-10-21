import clsx from 'clsx'
import { ArrowLeftRight, ClipboardList, PackagePlus, Recycle, ShieldAlert, ShoppingCart, Tag, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useUsuarioActual } from '../../api/consultas'
import type { Rol } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { Ajustes } from './Ajustes'
import { Conteo } from './Conteo'
import { Cuarentena } from './Cuarentena'
import { Envases } from './Envases'
import { Pedidos } from './Pedidos'
import { Promociones } from './Promociones'
import { Recepcion } from './Recepcion'
import { Traslados } from './Traslados'

// Espejo de docs/PERMISOS.md: quién ve cada operación (el backend valida igual).
const OPERACIONES: { tipo: string; titulo: string; descripcion: string; icono: LucideIcon; roles: Rol[]; Pantalla: () => React.JSX.Element }[] = [
  { tipo: 'recepcion', titulo: 'Recepción', descripcion: 'Producción de planta', icono: PackagePlus, roles: ['R06', 'R07'], Pantalla: Recepcion },
  { tipo: 'pedidos', titulo: 'Pedidos', descripcion: 'Reserva, despacho FIFO', icono: ShoppingCart, roles: ['R01', 'R03', 'R06', 'R07', 'R08', 'R09'], Pantalla: Pedidos },
  { tipo: 'traslados', titulo: 'Traslados', descripcion: 'Entre plantas', icono: ArrowLeftRight, roles: ['R03', 'R06', 'R07', 'R08', 'R09'], Pantalla: Traslados },
  { tipo: 'conteo', titulo: 'Conteo físico', descripcion: 'Ciego, cíclico o general', icono: ClipboardList, roles: ['R06', 'R07'], Pantalla: Conteo },
  { tipo: 'ajustes', titulo: 'Ajustes y mermas', descripcion: 'Quedan pendientes', icono: TriangleAlert, roles: ['R06', 'R07'], Pantalla: Ajustes },
  { tipo: 'cuarentena', titulo: 'Cuarentena', descripcion: 'Capas que no se venden', icono: ShieldAlert, roles: ['R06', 'R07'], Pantalla: Cuarentena },
  { tipo: 'envases', titulo: 'Envases', descripcion: 'Entrega y devolución', icono: Recycle, roles: ['R02', 'R06', 'R07', 'R08', 'R09'], Pantalla: Envases },
  { tipo: 'promociones', titulo: 'Promociones', descripcion: 'Propuesta y uso del tope', icono: Tag, roles: ['R02', 'R03', 'R06', 'R07', 'R08', 'R09'], Pantalla: Promociones },
]

export function Operaciones() {
  const { rol } = useUsuarioActual()
  const [params, setParams] = useSearchParams()
  const visibles = OPERACIONES.filter((o) => rol && o.roles.includes(rol))
  // `accion` se acepta por compatibilidad con enlaces anteriores.
  const pedida = params.get('tipo') ?? params.get('accion')
  const actual = visibles.find((o) => o.tipo === pedida) ?? visibles[0]
  if (!actual) return <EstadoVacio titulo="Tu rol no tiene operaciones disponibles" />
  const { Pantalla } = actual
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Operaciones</h1>
        <p className="secundario mt-1 text-suave">Cada operación muestra su efecto: capas FIFO, costos y alertas.</p>
      </div>
      <nav aria-label="Operaciones" className="grid gap-3 sm:grid-cols-4 2xl:grid-cols-8">
        {visibles.map(({ tipo, titulo, descripcion, icono: Icono }) => (
          <button
            key={tipo}
            type="button"
            aria-current={actual.tipo === tipo ? 'page' : undefined}
            onClick={() => setParams({ tipo })}
            className={clsx('flex items-center gap-3 rounded-2xl border bg-superficie p-3 text-left shadow-tarjeta transition hover:-translate-y-px', actual.tipo === tipo ? 'border-acento ring-2 ring-acento' : 'border-borde')}
            data-operacion={tipo}
          >
            <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl', actual.tipo === tipo ? 'bg-acento text-sobre-color' : 'bg-acento-suave text-acento')}>
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{titulo}</span>
              <span className="block truncate text-xs text-suave">{descripcion}</span>
            </span>
          </button>
        ))}
      </nav>
      {/* La clave reinicia el formulario al cambiar de operación o de parámetros. */}
      <Pantalla key={`${actual.tipo}-${params.toString()}`} />
    </div>
  )
}
