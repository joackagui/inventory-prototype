import { useMutation } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/cliente'
import { useCapasFiltro, useImpactoAjuste } from '../../api/consultas'
import type { Ajuste } from '../../api/tipos'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Tarjeta } from '../../componentes/Tarjeta'
import { dinero, fecha, numero } from '../../utils/formato'
import { SelectorAlmacenOperacion, SelectorArticulo, useAlmacenOperacion } from './comun'

export const MOTIVOS = [
  { valor: 'ROTURA', texto: 'Rotura' },
  { valor: 'VENCIMIENTO', texto: 'Vencimiento' },
  { valor: 'DIFERENCIA_CONTEO', texto: 'Diferencia de conteo' },
  { valor: 'PERDIDA_ROBO', texto: 'Pérdida o robo' },
  { valor: 'ERROR_REGISTRO', texto: 'Error de registro' },
  { valor: 'PROMOCION', texto: 'Promoción' },
]

export function Ajustes() {
  const { fijo, inicial, params } = useAlmacenOperacion()
  const [almacen, setAlmacen] = useState(inicial)
  const [articulo, setArticulo] = useState(params.get('articulo') ?? '')
  const [motivo, setMotivo] = useState('ROTURA')
  const [cantidad, setCantidad] = useState('')
  const [capaId, setCapaId] = useState(params.get('capa') ?? '')
  const [observacion, setObservacion] = useState('')
  const alm = fijo ?? almacen
  const n = Number(cantidad)
  const valida = cantidad !== '' && Number.isInteger(n) && n !== 0
  const capas = useCapasFiltro({ almacen: alm, articulo }, !!articulo).data ?? []
  const impacto = useImpactoAjuste(useDeferredValue({ almacen: alm, articulo, cantidad: valida ? n : undefined, capaId: capaId ? Number(capaId) : undefined }))
  const registrar = useMutation({ mutationFn: () => api<Ajuste>('/ajustes', { metodo: 'POST', cuerpo: { almacen: alm, articulo, cantidad: n, motivo, capaId: capaId ? Number(capaId) : undefined, observacion: observacion || undefined } }) })
  const r = registrar.data
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <Tarjeta titulo="Ajuste o merma" subtitulo="Queda PENDIENTE: no mueve stock hasta que R07 lo apruebe">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valida && articulo) registrar.mutate()
          }}
        >
          <Campo etiqueta="Almacén">
            <SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} fijo={fijo} />
          </Campo>
          <Campo etiqueta="Artículo">
            <SelectorArticulo
              valor={articulo}
              onCambiar={(a) => {
                setArticulo(a)
                setCapaId('')
              }}
            />
          </Campo>
          <Campo etiqueta="Motivo">
            <select className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
              {MOTIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Cantidad con signo" ayuda="Negativa para una baja (−6), positiva para un alta" error={cantidad && !valida ? 'Debe ser un entero distinto de 0' : null}>
            <input className={campo} type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-label="Cantidad con signo" />
          </Campo>
          <Campo etiqueta="Capa (opcional)" ayuda="Sin capa, una baja consume FIFO" className="sm:col-span-2">
            <select className={campo} value={capaId} onChange={(e) => setCapaId(e.target.value)} aria-label="Capa">
              <option value="">FIFO (la más antigua primero)</option>
              {capas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lote} · {numero(c.cantidadRestante)} u. · vence {fecha(c.fechaVencimiento)} · {c.estado === 'CUARENTENA' ? 'en cuarentena' : `${c.vidaRestanteDias} días`}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Observación" className="sm:col-span-2">
            <input className={campo} value={observacion} onChange={(e) => setObservacion(e.target.value)} aria-label="Observación" />
          </Campo>
          {impacto.data && (
            <p className="rounded-lg bg-superficie-2 p-3 text-sm sm:col-span-2" data-testid="impacto-ajuste">
              Impacto estimado: <b className={impacto.data.valor < 0 ? 'text-rojo' : 'text-verde'}>{impacto.data.valor < 0 ? '−' : '+'}
                {dinero(Math.abs(impacto.data.valor))}</b> ({impacto.data.capas.map((c) => `${numero(c.cantidad)} × ${numero(c.costoUnitario, 2)} de ${c.lote}`).join(' + ')})
              {!!impacto.data.faltante && <span className="block text-rojo">No hay stock suficiente: faltan {numero(impacto.data.faltante)}.</span>}
            </p>
          )}
          <BotonPrimario type="submit" disabled={!valida || !articulo} cargando={registrar.isPending} className="sm:col-span-2">
            Registrar (queda pendiente)
          </BotonPrimario>
        </form>
      </Tarjeta>
      {r ? (
        <ResultadoOperacion
          titulo={`Ajuste #${r.id} registrado: PENDIENTE de aprobación`}
          detalles={[
            ['Artículo', r.articulo.codigo],
            ['Motivo', MOTIVOS.find((m) => m.valor === r.motivo)?.texto ?? r.motivo],
            ['Cantidad', numero(r.cantidad)],
            ['Registrado por', r.registradoPor.codigo],
          ]}
          cambioStock="Aún no hay movimientos: el stock cambia cuando R07 lo aprueba (quien registra no aprueba)."
          efecto={r.efectoAlertas}
          acciones={
            <Link to={`/aprobaciones?ajuste=${r.id}`} className="inline-block rounded-lg border border-borde px-4 py-2 font-semibold">
              Ver en Aprobaciones
            </Link>
          }
        />
      ) : (
        <Regla>Rotura, vencimiento y robo son mermas; la diferencia de conteo y el error de registro, ajustes. R06 registra y R07 aprueba: quien registra no puede aprobar.</Regla>
      )}
    </div>
  )
}
