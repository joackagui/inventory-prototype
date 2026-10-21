import clsx from 'clsx'
import { Search } from 'lucide-react'
import type { ColorAlerta } from '../../api/tipos'
import { SEMAFORO } from '../../componentes/Semaforo'
import { type ClaveFamilia, FAMILIAS } from './familias'

export interface Filtros {
  estado: 'VIGENTE' | 'ATENDIDA' | 'RESUELTA'
  color: ColorAlerta | ''
  familia: ClaveFamilia | ''
  busqueda: string
  rol: string
  orden: 'gravedad' | 'antiguedad'
  agrupar: 'ninguno' | 'codigo' | 'almacen' | 'articulo'
  rapido: '' | 'sinAtender' | 'escaladas'
}

export const FILTROS_INICIALES: Filtros = { estado: 'VIGENTE', color: '', familia: '', busqueda: '', rol: '', orden: 'gravedad', agrupar: 'ninguno', rapido: '' }

// Parámetros de GET /api/alertas a partir de los filtros (el almacén lo pone la barra superior).
export function aParametros(f: Filtros, almacen: string) {
  const p = new URLSearchParams({ tamano: '500', orden: f.orden })
  if (f.rapido === 'sinAtender') p.set('sinAtender', 'true')
  else p.set('estado', f.estado)
  if (f.rapido === 'escaladas') p.set('escaladas', 'true')
  if (f.color) p.set('color', f.color)
  if (f.familia) p.set('codigos', FAMILIAS.find((x) => x.clave === f.familia)!.codigos.join(','))
  if (f.rol) p.set('rol', f.rol)
  if (almacen !== 'TODOS') p.set('almacen', almacen)
  return p.toString()
}

const ESTADOS = [
  { valor: 'VIGENTE', texto: 'Vigentes' },
  { valor: 'ATENDIDA', texto: 'Atendidas' },
  { valor: 'RESUELTA', texto: 'Resueltas' },
] as const

const campo = 'rounded-lg border border-borde bg-superficie px-3 py-2 text-sm'

export function FiltrosAlertas({ valor, onCambiar, roles }: { valor: Filtros; onCambiar: (f: Filtros) => void; roles: { codigo: string; nombre: string }[] }) {
  const fijar = <K extends keyof Filtros>(clave: K, v: Filtros[K]) => onCambiar({ ...valor, [clave]: v, ...(clave === 'estado' ? { rapido: '' } : {}) })
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="filtros-alertas">
      <div role="radiogroup" aria-label="Estado" className="inline-flex rounded-xl border border-borde bg-superficie-2 p-1">
        {ESTADOS.map((e) => (
          <button key={e.valor} type="button" role="radio" aria-checked={!valor.rapido && valor.estado === e.valor} onClick={() => fijar('estado', e.valor)} className={clsx('rounded-lg px-3 py-1.5 text-sm font-semibold', !valor.rapido && valor.estado === e.valor ? 'bg-marca text-marca-texto' : 'text-suave hover:text-texto')}>
            {e.texto}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Color" className="flex gap-1">
        {(['ROJO', 'AMARILLO', 'AZUL'] as const).map((c) => {
          const Icono = SEMAFORO[c].icono
          return (
            <button key={c} type="button" aria-pressed={valor.color === c} onClick={() => fijar('color', valor.color === c ? '' : c)} className={clsx('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold', valor.color === c ? `${SEMAFORO[c].clase} border-transparent` : 'border-borde bg-superficie text-suave')}>
              <Icono aria-hidden className="size-4" /> {SEMAFORO[c].texto}
            </button>
          )
        })}
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-suave">
        Tipo de alerta
        <select className={campo} value={valor.familia} onChange={(e) => fijar('familia', e.target.value as ClaveFamilia | '')} aria-label="Tipo de alerta">
          <option value="">Todos los tipos</option>
          {FAMILIAS.map((f) => (
            <option key={f.clave} value={f.clave}>
              {f.nombre} ({f.codigos.join(' ')})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-suave">
        Responsable
        <select className={campo} value={valor.rol} onChange={(e) => fijar('rol', e.target.value)} aria-label="Responsable">
          <option value="">Todos</option>
          {roles.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {r.codigo} · {r.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-suave">
        Artículo
        <span className="relative">
          <Search aria-hidden className="absolute top-2.5 left-2.5 size-4" />
          <input type="search" className={clsx(campo, 'w-44 pl-8')} placeholder="ART-10063" value={valor.busqueda} onChange={(e) => fijar('busqueda', e.target.value)} aria-label="Buscar artículo" />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-suave">
        Orden
        <select className={campo} value={valor.orden} onChange={(e) => fijar('orden', e.target.value as Filtros['orden'])} aria-label="Orden">
          <option value="gravedad">Por gravedad</option>
          <option value="antiguedad">Más antiguas primero</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-suave">
        Agrupar
        <select className={campo} value={valor.agrupar} onChange={(e) => fijar('agrupar', e.target.value as Filtros['agrupar'])} aria-label="Agrupar">
          <option value="ninguno">Sin agrupar</option>
          <option value="codigo">Por código</option>
          <option value="almacen">Por almacén</option>
          <option value="articulo">Por artículo</option>
        </select>
      </label>
    </div>
  )
}
