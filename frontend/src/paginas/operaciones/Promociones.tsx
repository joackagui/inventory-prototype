import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api } from '../../api/cliente'
import { useFecha, usePromociones } from '../../api/consultas'
import type { Promocion } from '../../api/tipos'
import { BotonPrimario, Campo, campo } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { fecha, numero } from '../../utils/formato'
import { SelectorAlmacenOperacion, SelectorArticulo, useAlmacenOperacion } from './comun'

const TIPOS = [
  { valor: 'BONIFICACION', texto: 'Bonificación en especie' },
  { valor: 'DESCUENTO_FESTIVO', texto: 'Descuento festivo' },
  { valor: 'LIQUIDACION_VENCIMIENTO', texto: 'Liquidación por vencimiento' },
  { valor: 'ROTACION_EXCESO', texto: 'Rotación de exceso' },
]
const ESTADO: Record<string, string> = { PROPUESTA: 'bg-amarillo-fondo text-amarillo', ACTIVA: 'bg-verde-fondo text-verde', FINALIZADA: 'bg-superficie-2 text-suave', BORRADOR: 'bg-superficie-2 text-suave' }

export function Promociones() {
  const { rol, inicial, params } = useAlmacenOperacion()
  const { data: hoy } = useFecha()
  const lista = usePromociones()
  const [f, setF] = useState({ nombre: '', tipo: 'BONIFICACION', articulo: params.get('articulo') ?? '', almacen: inicial, fechaInicio: '', fechaFin: '', topeCajas: '' })
  const fijar = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v })
  const inicio = f.fechaInicio || hoy?.fechaSimulada || ''
  const proponer = useMutation({ mutationFn: () => api<Promocion>('/promociones', { metodo: 'POST', cuerpo: { ...f, fechaInicio: inicio, topeCajas: Number(f.topeCajas) } }) })
  const valida = f.nombre && f.articulo && inicio && f.fechaFin && f.fechaFin >= inicio && Number(f.topeCajas) > 0
  return (
    <div className="space-y-6">
      {proponer.data && <ResultadoOperacion titulo={`Promoción «${proponer.data.nombre}» propuesta`} detalles={[['Estado', 'PROPUESTA'], ['Tope', numero(proponer.data.topeCajas)]]} cambioStock="R07 la aprueba en Aprobaciones con la referencia del correo del Gerente de Logística y Ventas." />}
      {rol === 'R02' && (
        <Tarjeta titulo="Proponer promoción" subtitulo="Queda PROPUESTA hasta que R07 la apruebe">
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (valida) proponer.mutate()
            }}
          >
            <Campo etiqueta="Nombre" className="sm:col-span-2">
              <input className={campo} value={f.nombre} onChange={(e) => fijar('nombre')(e.target.value)} aria-label="Nombre de la promoción" />
            </Campo>
            <Campo etiqueta="Tipo">
              <select className={campo} value={f.tipo} onChange={(e) => fijar('tipo')(e.target.value)} aria-label="Tipo de promoción">
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Artículo">
              <SelectorArticulo valor={f.articulo} onCambiar={fijar('articulo')} />
            </Campo>
            <Campo etiqueta="Almacén">
              <SelectorAlmacenOperacion valor={f.almacen} onCambiar={fijar('almacen')} />
            </Campo>
            <Campo etiqueta="Desde">
              <input className={campo} type="date" value={inicio} onChange={(e) => fijar('fechaInicio')(e.target.value)} aria-label="Desde" />
            </Campo>
            <Campo etiqueta="Hasta" error={f.fechaFin && f.fechaFin < inicio ? 'Debe ser posterior al inicio' : null}>
              <input className={campo} type="date" value={f.fechaFin} onChange={(e) => fijar('fechaFin')(e.target.value)} aria-label="Hasta" />
            </Campo>
            <Campo etiqueta="Tope de cajas">
              <input className={campo} type="number" min={1} value={f.topeCajas} onChange={(e) => fijar('topeCajas')(e.target.value)} aria-label="Tope de cajas" />
            </Campo>
            <BotonPrimario type="submit" disabled={!valida} cargando={proponer.isPending} className="sm:col-span-2 xl:col-span-4">
              Proponer promoción
            </BotonPrimario>
          </form>
        </Tarjeta>
      )}
      <Tarjeta titulo="Promociones" subtitulo="Uso del tope y cobertura del stock vendible frente a los días que le quedan (AL15)">
        {lista.isPending ? (
          <Esqueleto className="h-48" />
        ) : (
          <ul className="space-y-3" data-testid="lista-promociones">
            {lista.data?.map((p) => (
              <li key={p.id} className="rounded-xl border border-borde p-3" data-promocion={p.nombre}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <b>{p.nombre}</b> <span className="text-suave">· {TIPOS.find((t) => t.valor === p.tipo)?.texto} · {p.articulo.codigo} · {p.almacen?.codigo ?? 'todos los almacenes'}</span>
                    <span className="num block text-sm text-suave">
                      {fecha(p.fechaInicio)} – {fecha(p.fechaFin)} · propuesta por {p.propuestaPor?.codigo ?? 'seed'}
                      {p.referenciaCorreo && ` · aprobada con ${p.referenciaCorreo}`}
                    </span>
                  </p>
                  <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', ESTADO[p.estado])}>{p.estado.toLowerCase()}</span>
                </div>
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="num text-xs text-suave">
                      Tope usado {numero(p.cajasUsadas)} de {numero(p.topeCajas)} (quedan {numero(p.topeRestante)})
                    </p>
                    <div className="mt-1 h-2 rounded-full bg-superficie-2" role="meter" aria-valuemin={0} aria-valuemax={p.topeCajas} aria-valuenow={p.cajasUsadas} aria-label="Uso del tope">
                      <div className="h-full rounded-full bg-acento" style={{ width: `${(p.cajasUsadas / p.topeCajas) * 100}%` }} />
                    </div>
                  </div>
                  <p className={clsx('num', p.estado === 'ACTIVA' && p.coberturaDias < p.diasRestantes && 'font-semibold text-amarillo')}>
                    Cobertura {numero(p.coberturaDias, 1)} días · quedan {numero(p.diasRestantes)} días de promoción
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
