import { ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SinAcceso() {
  return (
    <div className="entrar mx-auto mt-16 flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-borde bg-superficie p-10 text-center shadow-tarjeta">
      <span className="grid size-14 place-items-center rounded-full bg-amarillo-fondo text-amarillo">
        <ShieldOff aria-hidden className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">Tu rol no tiene acceso a esta sección</h1>
      <p className="text-suave">Cambia de usuario en la esquina superior derecha o vuelve al tablero.</p>
      <Link to="/tablero" className="mt-2 rounded-lg bg-marca px-4 py-2 font-medium text-marca-texto">
        Ir al tablero
      </Link>
    </div>
  )
}
