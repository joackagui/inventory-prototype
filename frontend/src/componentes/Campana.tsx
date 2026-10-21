import clsx from 'clsx'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useResumenAlertas, useUsuarioActual } from '../api/consultas'
import { puede } from '../sesion/permisos'

// Contador de alertas rojas sin atender; lleva al centro de alertas.
export function Campana() {
  const { rol } = useUsuarioActual()
  const visible = puede.verAlertas(rol)
  const { data } = useResumenAlertas(visible)
  if (!visible) return null
  const rojas = data?.rojasSinAtender ?? 0
  return (
    <Link to="/alertas" aria-label={`Alertas: ${rojas} rojas sin atender`} className="relative grid size-10 place-items-center rounded-xl border border-borde bg-superficie hover:bg-superficie-2" data-testid="campana">
      <Bell aria-hidden className="size-5" />
      {rojas > 0 && (
        <span className={clsx('num pulso-rojo absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-rojo px-1 text-xs font-bold text-white')} data-testid="campana-contador">
          {rojas}
        </span>
      )}
    </Link>
  )
}
