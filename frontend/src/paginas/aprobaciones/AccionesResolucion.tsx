import { useState } from 'react'
import { BotonPrimario, campo } from '../../componentes/Formulario'

// Por qué un usuario no puede decidir: solo R07 aprueba, y nunca lo que registró él mismo.
export function motivoNoAprobar(rol: string | undefined, usuarioId: number | undefined, registradoPorId?: number) {
  if (rol === 'R08') return 'Solo lectura: Gerencia consulta, no aprueba.'
  if (rol !== 'R07') return 'Solo el coordinador de logística (R07) aprueba.'
  if (registradoPorId !== undefined && registradoPorId === usuarioId) return 'Quien registra no aprueba: otro coordinador debe decidirlo.'
  return null
}

interface Props {
  bloqueo: string | null
  cargando: boolean
  onAprobar: (comentario: string, referencia: string) => void
  onRechazar: (comentario: string) => void
  textoAprobar?: string
  textoRechazar?: string
  // Promociones: exige la referencia del correo del Gerente de Logística y Ventas.
  pideReferencia?: boolean
}

export function AccionesResolucion({ bloqueo, cargando, onAprobar, onRechazar, textoAprobar = 'Aprobar', textoRechazar = 'Rechazar', pideReferencia = false }: Props) {
  const [comentario, setComentario] = useState('')
  const [referencia, setReferencia] = useState('')
  const [intentoRechazo, setIntentoRechazo] = useState(false)
  const sinComentario = intentoRechazo && !comentario.trim()
  return (
    <div className="space-y-3 rounded-xl border border-borde p-4" data-testid="acciones-resolucion">
      {pideReferencia && (
        <label className="block text-sm">
          Referencia del correo del Gerente de Logística y Ventas
          <input className={`${campo} mt-1`} value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={!!bloqueo} placeholder="CORREO-GLV-2027-0412" aria-label="Referencia del correo" />
        </label>
      )}
      <label className="block text-sm">
        Comentario (obligatorio para rechazar)
        <textarea className={`${campo} mt-1`} rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={!!bloqueo} aria-label="Comentario" aria-invalid={sinComentario} />
      </label>
      {sinComentario && (
        <p className="text-sm text-rojo" role="alert">
          Escribe por qué se rechaza.
        </p>
      )}
      {bloqueo && (
        <p className="rounded-lg bg-amarillo-fondo p-3 text-sm text-amarillo" role="note">
          {bloqueo}
        </p>
      )}
      <div className="flex gap-2">
        <BotonPrimario type="button" className="flex-1" disabled={!!bloqueo || (pideReferencia && !referencia.trim())} cargando={cargando} onClick={() => onAprobar(comentario.trim(), referencia.trim())}>
          {textoAprobar}
        </BotonPrimario>
        <button
          type="button"
          disabled={!!bloqueo || cargando}
          onClick={() => {
            setIntentoRechazo(true)
            if (comentario.trim()) onRechazar(comentario.trim())
          }}
          className="flex-1 rounded-xl border-2 border-rojo px-4 py-2.5 font-semibold text-rojo disabled:cursor-not-allowed disabled:opacity-40"
        >
          {textoRechazar}
        </button>
      </div>
    </div>
  )
}
