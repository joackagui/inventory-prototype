import { Bell, Boxes, Calculator, ClipboardCheck, LayoutDashboard, PartyPopper, PieChart, Settings, Truck, type LucideIcon } from 'lucide-react'
import type { Rol } from '../api/tipos'

// Espejo de docs/PERMISOS.md: el backend valida; aquí solo se decide qué se muestra.
export const TODOS: Rol[] = ['R01', 'R02', 'R03', 'R06', 'R07', 'R08', 'R09']
export const LECTURA: Rol[] = ['R02', 'R03', 'R06', 'R07', 'R08', 'R09']

export interface Seccion {
  ruta: string
  titulo: string
  descripcion: string
  icono: LucideIcon
  roles: Rol[]
}

export const SECCIONES: Seccion[] = [
  { ruta: '/tablero', titulo: 'Tablero', descripcion: 'Torre de control del inventario', icono: LayoutDashboard, roles: TODOS },
  { ruta: '/alertas', titulo: 'Alertas', descripcion: 'Centro de alertas: filtrar, atender y seguir el semáforo AL01–AL16', icono: Bell, roles: LECTURA },
  { ruta: '/articulos', titulo: 'Artículos', descripcion: 'Ficha del artículo: parámetros, capas FIFO, kardex valorado y movimiento', icono: Boxes, roles: TODOS },
  { ruta: '/operaciones', titulo: 'Operaciones', descripcion: 'Recepción, pedido y despacho, traslados, conteos, ajustes, cuarentena y envases', icono: Truck, roles: TODOS },
  { ruta: '/aprobaciones', titulo: 'Aprobaciones', descripcion: 'Ajustes, mermas, diferencias de recepción y promociones pendientes', icono: ClipboardCheck, roles: ['R07', 'R08'] },
  { ruta: '/analisis', titulo: 'Análisis', descripcion: 'Análisis ABC / Pareto y ranking de ajustes por motivo', icono: PieChart, roles: ['R02', 'R07', 'R08'] },
  { ruta: '/fiestas', titulo: 'Fiestas', descripcion: 'Calendario, factor estacional, ROP de fiesta, pronóstico y preparación', icono: PartyPopper, roles: ['R02', 'R07', 'R08'] },
  { ruta: '/costos', titulo: 'Costos', descripcion: 'Adquisición, conservación, pedido y agotamiento por artículo', icono: Calculator, roles: ['R07', 'R08'] },
  { ruta: '/administracion', titulo: 'Administración', descripcion: 'Fecha simulada, usuarios, re-siembra y simulación de fallas (AL11, AL16)', icono: Settings, roles: ['R07', 'R08', 'R09'] },
]

export const puede = {
  verAlertas: (rol?: Rol) => !!rol && LECTURA.includes(rol),
  cambiarFecha: (rol?: Rol) => rol === 'R07' || rol === 'R09',
}

export const seccionDe = (ruta: string) => SECCIONES.find((s) => ruta === s.ruta || ruta.startsWith(`${s.ruta}/`))
