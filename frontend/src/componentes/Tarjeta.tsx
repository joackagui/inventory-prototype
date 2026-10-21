import clsx from 'clsx'
import type { ReactNode } from 'react'

export function Tarjeta({ titulo, subtitulo, acciones, children, className, style }: { titulo?: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={clsx('entrar rounded-2xl border border-borde bg-superficie shadow-tarjeta', className)} style={style}>
      {titulo && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borde px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-suave">{subtitulo}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-lg bg-superficie-2', className)} />
}
