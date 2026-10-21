import clsx from 'clsx'
import { Warehouse } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useUsuarioActual } from '../api/consultas'
import type { Rol } from '../api/tipos'
import { Campana } from '../componentes/Campana'
import { RelojSimulado } from '../componentes/RelojSimulado'
import { SelectorAlmacen } from '../componentes/SelectorAlmacen'
import { SelectorUsuario } from '../componentes/SelectorUsuario'
import { Esqueleto } from '../componentes/Tarjeta'
import { TemaToggle } from '../componentes/TemaToggle'
import { SinAcceso } from '../paginas/SinAcceso'
import { SECCIONES } from '../sesion/permisos'

// Barra lateral: solo íconos hasta 1536 px (proyector de 1366) y con etiquetas en pantallas anchas.
function BarraLateral() {
  const { rol } = useUsuarioActual()
  return (
    <aside className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col bg-marca text-marca-texto 2xl:w-64">
      <div className="flex items-center gap-3 px-4 py-5 2xl:px-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-2">
          <Warehouse aria-hidden className="size-6" />
        </span>
        <span className="hidden leading-tight 2xl:block">
          <span className="block font-bold tracking-tight">Inventario CBN</span>
          <span className="block text-xs text-marca-texto-suave">Torre de control</span>
        </span>
      </div>
      <nav aria-label="Secciones" className="flex-1 space-y-1 overflow-y-auto px-3">
        {SECCIONES.filter((s) => rol && s.roles.includes(rol)).map(({ ruta, titulo, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            title={titulo}
            className={({ isActive }) =>
              clsx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.95rem] font-medium transition-colors', isActive ? 'bg-marca-2 text-white shadow-inner' : 'text-marca-texto-suave hover:bg-white/5 hover:text-white')
            }
          >
            <Icono aria-hidden className="size-5 shrink-0" />
            <span className="hidden 2xl:inline">{titulo}</span>
          </NavLink>
        ))}
      </nav>
      <p className="hidden px-5 py-4 text-xs text-marca-texto-suave 2xl:block">Prototipo · datos de muestra</p>
    </aside>
  )
}

function BarraSuperior() {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-borde bg-fondo/85 px-6 py-3 backdrop-blur">
      <SelectorAlmacen />
      <RelojSimulado />
      <div className="ml-auto flex items-center gap-2">
        <Campana />
        <TemaToggle />
        <SelectorUsuario />
      </div>
    </header>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <main className="mx-auto w-full max-w-[1760px] flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Protege una pantalla según el rol (el backend valida igual; esto evita mostrar lo que no se puede usar).
export function RequiereRol({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { rol, cargando } = useUsuarioActual()
  if (cargando) return <Esqueleto className="h-64 w-full" />
  return rol && roles.includes(rol) ? children : <SinAcceso />
}
