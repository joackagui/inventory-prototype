import * as Dialog from '@radix-ui/react-dialog'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { BotonPrimario, campo } from './Formulario'

// Restablecer datos de la demo: solo se confirma escribiendo RESTABLECER.
export function DialogoRestablecer({ abierto, onCerrar, onConfirmar, cargando }: { abierto: boolean; onCerrar: () => void; onConfirmar: () => void; cargando: boolean }) {
  const [texto, setTexto] = useState('')
  const listo = texto === 'RESTABLECER'
  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(v) => {
        if (!v && !cargando) {
          setTexto('')
          onCerrar()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="entrar fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-rojo bg-superficie p-6 shadow-2xl" data-testid="dialogo-restablecer">
          <Dialog.Title className="flex items-center gap-2 text-xl font-semibold">
            <RotateCcw aria-hidden className="size-5 text-rojo" /> Restablecer datos de la demo
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm">
            Borra todo lo hecho durante la demo y vuelve a sembrar el estado base del <b>30/06/2027</b> (19 alertas). Es una herramienta de ensayo: no existe en un sistema real.
          </Dialog.Description>
          <label className="mt-4 block text-sm">
            Escribe <b>RESTABLECER</b> para confirmar
            <input className={`${campo} mt-1 font-mono`} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={cargando} aria-label="Confirmación" autoComplete="off" />
          </label>
          {cargando && (
            <div className="mt-4" role="status">
              <p className="text-sm font-semibold">Restableciendo… la API responde 503 mientras tanto.</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-superficie-2">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-rojo" />
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close className="rounded-lg border border-borde px-4 py-2 font-medium" disabled={cargando}>
              Cancelar
            </Dialog.Close>
            <BotonPrimario type="button" className="bg-rojo text-sobre-color hover:bg-rojo" disabled={!listo} cargando={cargando} onClick={onConfirmar}>
              Restablecer datos
            </BotonPrimario>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
