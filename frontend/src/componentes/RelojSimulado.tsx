import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../api/cliente'
import { useFecha, useUsuarioActual } from '../api/consultas'
import type { CambioFecha } from '../api/tipos'
import { puede } from '../sesion/permisos'
import { fecha as formatoFecha } from '../utils/formato'
import { ControlFecha } from './ControlFecha'

type Accion = { tipo: 'mover'; dias: number } | { tipo: 'fijar'; fecha: string } | { tipo: 'restablecer' }

export function RelojSimulado() {
  const { rol } = useUsuarioActual()
  const { data } = useFecha()
  const cliente = useQueryClient()
  const cambio = useMutation({
    mutationFn: (a: Accion) =>
      a.tipo === 'mover'
        ? api<CambioFecha>('/simulacion/avanzar', { metodo: 'POST', cuerpo: { dias: a.dias } })
        : a.tipo === 'fijar'
          ? api<CambioFecha>('/simulacion/fecha', { metodo: 'PUT', cuerpo: { fecha: a.fecha } })
          : api<CambioFecha>('/simulacion/restablecer', { metodo: 'POST' }),
    onSuccess: (r) => {
      const a = r.alertas
      const cambiaron = a ? a.creadas + a.cambiosColor + a.resueltas : 0
      toast.success(`Fecha simulada: ${formatoFecha(r.fechaSimulada)}`, {
        description: a ? `${cambiaron} alertas cambiaron · ${a.creadas} nuevas, ${a.cambiosColor} de color, ${a.resueltas} resueltas, ${a.escaladas} escaladas · ${a.abiertas} vigentes` : undefined,
      })
      return cliente.invalidateQueries()
    },
  })
  return (
    <ControlFecha
      fecha={data?.fechaSimulada ?? null}
      puedeCambiar={puede.cambiarFecha(rol)}
      ocupado={cambio.isPending}
      onMover={(dias) => cambio.mutate({ tipo: 'mover', dias })}
      onFijar={(fecha) => cambio.mutate({ tipo: 'fijar', fecha })}
      onRestablecer={() => cambio.mutate({ tipo: 'restablecer' })}
    />
  )
}
