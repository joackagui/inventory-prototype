import { useSearchParams } from 'react-router-dom'
import { useAlmacenes, useEstadoArticulos, useUsuarioActual } from '../../api/consultas'
import { campo } from '../../componentes/Formulario'
import { useSesion } from '../../sesion/Sesion'

// Almacén de la operación: R06 queda fijo en el suyo; el resto parte de la URL o del almacén global.
export function useAlmacenOperacion() {
  const { usuario, rol } = useUsuarioActual()
  const { almacen: global } = useSesion()
  const [params] = useSearchParams()
  const { data: almacenes = [] } = useAlmacenes()
  const fijo = rol === 'R06' ? usuario?.almacen?.codigo : undefined
  const inicial = fijo ?? params.get('almacen') ?? (global !== 'TODOS' ? global : almacenes[0]?.codigo) ?? ''
  return { fijo, inicial, almacenes, rol, usuario, params }
}

export function SelectorAlmacenOperacion({ valor, onCambiar, fijo, etiqueta = 'Almacén' }: { valor: string; onCambiar: (v: string) => void; fijo?: string; etiqueta?: string }) {
  const { data: almacenes = [] } = useAlmacenes()
  return (
    <select className={campo} value={fijo ?? valor} disabled={!!fijo} onChange={(e) => onCambiar(e.target.value)} aria-label={etiqueta} title={fijo ? 'Tu almacén asignado (no editable)' : undefined}>
      {almacenes.map((a) => (
        <option key={a.codigo} value={a.codigo}>
          {a.codigo} · {a.nombre}
        </option>
      ))}
    </select>
  )
}

export function SelectorArticulo({ valor, onCambiar, soloRetornables = false, etiqueta = 'Artículo' }: { valor: string; onCambiar: (v: string) => void; soloRetornables?: boolean; etiqueta?: string }) {
  const { data = [] } = useEstadoArticulos()
  return (
    <select className={campo} value={valor} onChange={(e) => onCambiar(e.target.value)} aria-label={etiqueta}>
      <option value="">Elige un artículo</option>
      {data
        .filter((a) => !soloRetornables || a.esRetornable)
        .map((a) => (
          <option key={a.codigo} value={a.codigo}>
            {a.codigo} · {a.descripcion}
          </option>
        ))}
    </select>
  )
}

export const ESTADO_PEDIDO: Record<string, { texto: string; clase: string }> = {
  CONFIRMADO: { texto: 'Confirmado (reservado)', clase: 'bg-azul-fondo text-azul' },
  PENDIENTE_REVISION: { texto: 'Pendiente de revisión', clase: 'bg-amarillo-fondo text-amarillo' },
  DESPACHADO: { texto: 'Despachado', clase: 'bg-verde-fondo text-verde' },
  CANCELADO: { texto: 'Cancelado', clase: 'bg-superficie-2 text-suave' },
}
