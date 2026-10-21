import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUsuarioActual, useUsuarios } from '../api/consultas'
import { seccionDe } from '../sesion/permisos'
import { useSesion } from '../sesion/Sesion'

// Cambiar de usuario cambia permisos, menú y datos (sin contraseñas: el backend lee X-Usuario).
export function SelectorUsuario() {
  const { data: usuarios } = useUsuarios()
  const { usuario } = useUsuarioActual()
  const { fijarUsuario } = useSesion()
  const navegar = useNavigate()
  const { pathname } = useLocation()

  const elegir = (codigo: string) => {
    const nuevo = usuarios?.find((u) => u.codigo === codigo)
    if (!nuevo || nuevo.codigo === usuario?.codigo) return
    fijarUsuario(codigo)
    toast.success(`Ahora operas como ${nuevo.codigo}`, { description: `${nuevo.nombre} · ${nuevo.rol.codigo} ${nuevo.rol.nombre}` })
    const seccion = seccionDe(pathname)
    if (seccion && !seccion.roles.includes(nuevo.rolCodigo)) navegar('/tablero')
  }

  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-3 rounded-xl border border-borde bg-superficie px-3 py-1.5 text-left hover:bg-superficie-2" data-testid="selector-usuario">
        <span className="sr-only">Cambiar de usuario:</span>
        <span className="grid size-8 place-items-center rounded-full bg-marca text-marca-texto">
          <UserRound aria-hidden className="size-4" />
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-semibold">{usuario?.codigo ?? '…'}</span>
          <span className="block max-w-32 truncate text-xs text-suave 2xl:max-w-44">{usuario ? `${usuario.rol.codigo} · ${usuario.nombre}` : 'Cargando'}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-suave" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="entrar z-50 min-w-72 rounded-xl border border-borde bg-superficie p-1.5 shadow-tarjeta">
          <Menu.Label className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-suave uppercase">Usuario de la demo</Menu.Label>
          {usuarios?.map((u) => (
            <Menu.Item key={u.codigo} onSelect={() => elegir(u.codigo)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none data-highlighted:bg-superficie-2">
              <span className="w-16 font-semibold">{u.codigo}</span>
              <span className="flex-1">
                <span className="block">{u.nombre}</span>
                <span className="block text-xs text-suave">
                  {u.rol.codigo} {u.rol.nombre}
                  {u.almacen ? ` · ${u.almacen.codigo}` : ''}
                </span>
              </span>
              {u.codigo === usuario?.codigo && <Check aria-label="Usuario actual" className="size-4 text-acento" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
