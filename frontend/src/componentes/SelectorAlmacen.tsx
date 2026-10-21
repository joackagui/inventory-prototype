import clsx from 'clsx'
import { ALMACENES } from '../api/consultas'
import { type FiltroAlmacen, useSesion } from '../sesion/Sesion'

const OPCIONES: { valor: FiltroAlmacen; texto: string; titulo: string }[] = [
  { valor: 'TODOS', texto: 'Todos', titulo: 'Los 3 almacenes' },
  ...ALMACENES.map((a) => ({ valor: a.codigo, texto: a.corto, titulo: `${a.codigo} · ${a.nombre}` })),
]

export function SelectorAlmacen() {
  const { almacen, fijarAlmacen } = useSesion()
  return (
    <div role="radiogroup" aria-label="Almacén" className="inline-flex rounded-xl border border-borde bg-superficie-2 p-1">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={almacen === o.valor}
          title={o.titulo}
          onClick={() => fijarAlmacen(o.valor)}
          className={clsx('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', almacen === o.valor ? 'bg-marca text-marca-texto shadow-sm' : 'text-suave hover:text-texto')}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
