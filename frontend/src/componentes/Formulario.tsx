import clsx from 'clsx'
import type { ReactNode } from 'react'

export const campo = 'w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm disabled:bg-superficie-2 disabled:text-suave'

// Etiqueta + control + ayuda o error en línea (errores en español, anunciados a lectores de pantalla).
export function Campo({ etiqueta, error, ayuda, children, className }: { etiqueta: string; error?: string | null; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium">{etiqueta}</span>
      {children}
      {error ? (
        <span className="text-xs text-rojo" role="alert">
          {error}
        </span>
      ) : (
        ayuda && <span className="text-xs text-suave">{ayuda}</span>
      )}
    </label>
  )
}

export function BotonPrimario({ children, cargando, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || cargando} aria-busy={cargando || undefined} className={clsx('rounded-xl bg-marca px-4 py-2.5 font-semibold text-marca-texto hover:bg-marca-2 disabled:cursor-not-allowed disabled:opacity-50', className)}>
      {cargando ? 'Enviando…' : children}
    </button>
  )
}

export function Regla({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border-l-4 border-acento bg-acento-suave px-3 py-2 text-sm">{children}</p>
}
