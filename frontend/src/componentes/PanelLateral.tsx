import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

// Panel lateral accesible (Radix Dialog): foco atrapado, Esc para cerrar, título anunciado.
export function PanelLateral({ abierto, onCerrar, titulo, descripcion, children }: { abierto: boolean; onCerrar: () => void; titulo: ReactNode; descripcion?: ReactNode; children: ReactNode }) {
  return (
    <Dialog.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content className="entrar fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-borde bg-superficie shadow-2xl outline-none">
          <header className="flex items-start justify-between gap-4 border-b border-borde p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
              {descripcion ? <Dialog.Description className="mt-1 text-sm text-suave">{descripcion}</Dialog.Description> : <Dialog.Description className="sr-only">Detalle</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-lg hover:bg-superficie-2" aria-label="Cerrar">
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
