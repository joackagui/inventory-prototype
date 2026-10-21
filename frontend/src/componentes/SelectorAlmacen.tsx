import clsx from 'clsx'
import { useAlmacenes } from '../api/consultas'
import { useSesion } from '../sesion/Sesion'

export function SelectorAlmacen() {
  const { almacen, fijarAlmacen } = useSesion()
  const { data: almacenes } = useAlmacenes()
  const opciones = [{ valor: 'TODOS', texto: 'Todos', titulo: 'Los 3 almacenes' }, ...(almacenes ?? []).map((a) => ({ valor: a.codigo, texto: a.corto, titulo: `${a.codigo} · ${a.nombreLargo}` }))]
  return (
    <div role="radiogroup" aria-label="Almacén" className="inline-flex rounded-xl border border-borde bg-superficie-2 p-1">
      {opciones.map((o) => (
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
