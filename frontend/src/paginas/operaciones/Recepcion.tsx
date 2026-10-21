import { useMutation } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { api } from '../../api/cliente'
import { useFecha, useRecepcionPrevia, useUbicaciones } from '../../api/consultas'
import type { Capa, ConEfecto } from '../../api/tipos'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { SEMAFORO } from '../../componentes/Semaforo'
import { Tarjeta } from '../../componentes/Tarjeta'
import { dinero, fecha, numero } from '../../utils/formato'
import { SelectorAlmacenOperacion, SelectorArticulo, useAlmacenOperacion } from './comun'

const yymmdd = (f: string) => f.slice(2, 10).replaceAll('-', '')

export function Recepcion() {
  const { fijo, inicial, params, almacenes } = useAlmacenOperacion()
  const { data: hoy } = useFecha()
  const [almacen, setAlmacen] = useState(inicial)
  const [articulo, setArticulo] = useState(params.get('articulo') ?? '')
  const [ubicacion, setUbicacion] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const [lote, setLote] = useState('')
  const [elaboracion, setElaboracion] = useState('')
  const alm = fijo ?? almacen
  const fechaElab = elaboracion || hoy?.fechaSimulada || ''
  const ubicaciones = useUbicaciones(alm).data?.filter((u) => u.vendible) ?? []
  const diferido = useDeferredValue({ almacen: alm, articulo, costoUnitario: Number(costo) || undefined, fechaElaboracion: fechaElab })
  const previa = useRecepcionPrevia(diferido)
  const ubic = ubicacion || previa.data?.ubicacionSugerida || ''
  const corto = almacenes.find((a) => a.codigo === alm)?.corto ?? ''
  const loteFinal = lote || (articulo && fechaElab ? `${corto}-${articulo.slice(4)}-${yymmdd(fechaElab)}` : '')
  const recibir = useMutation({
    mutationFn: () => api<Capa & ConEfecto>('/operaciones/recepcion', { metodo: 'POST', cuerpo: { almacen: alm, ubicacion: ubic, articulo, cantidad: Number(cantidad), costoUnitario: Number(costo), lote: loteFinal, fechaElaboracion: fechaElab } }),
  })
  const errores = {
    cantidad: cantidad && !(Number.isInteger(Number(cantidad)) && Number(cantidad) > 0) ? 'Debe ser un número entero mayor que 0' : null,
    costo: costo && !(Number(costo) > 0) ? 'El costo debe ser mayor que 0' : null,
  }
  const valido = alm && articulo && ubic && cantidad && costo && loteFinal && fechaElab && !errores.cantidad && !errores.costo
  const aviso = previa.data?.alertaCosto
  const r = recibir.data
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <Tarjeta titulo="Recepción de producción" subtitulo="Crea una capa FIFO con vencimiento = elaboración + vida útil y un movimiento ENTRADA">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valido) recibir.mutate()
          }}
        >
          <Campo etiqueta="Almacén" ayuda={fijo && 'Tu almacén asignado'}>
            <SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} fijo={fijo} />
          </Campo>
          <Campo etiqueta="Artículo">
            <SelectorArticulo valor={articulo} onCambiar={setArticulo} />
          </Campo>
          <Campo etiqueta="Ubicación" ayuda="PICK-A para retornables, PICK-B para latas, gaseosas y aguas">
            <select className={campo} value={ubic} onChange={(e) => setUbicacion(e.target.value)} aria-label="Ubicación">
              {ubicaciones.map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.codigo} · {u.descripcion}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Cantidad (cajas o packs)" error={errores.cantidad}>
            <input className={campo} type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-label="Cantidad" />
          </Campo>
          <Campo etiqueta="Costo unitario (USD)" error={errores.costo} ayuda={previa.data?.capaAnterior && `Capa anterior ${previa.data.capaAnterior.lote}: ${dinero(previa.data.capaAnterior.costoUnitario)}`}>
            <input className={campo} type="number" min={0.01} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} aria-label="Costo unitario" />
          </Campo>
          <Campo etiqueta="Fecha de elaboración">
            <input className={campo} type="date" value={fechaElab} max={hoy?.fechaSimulada ?? undefined} onChange={(e) => setElaboracion(e.target.value)} aria-label="Fecha de elaboración" />
          </Campo>
          <Campo etiqueta="Lote" className="sm:col-span-2">
            <input className={campo} value={loteFinal} onChange={(e) => setLote(e.target.value)} aria-label="Lote" />
          </Campo>
          {previa.data?.vencimiento && (
            <p className="text-sm sm:col-span-2" data-testid="vencimiento-calculado">
              Vence el <b className="num">{fecha(previa.data.vencimiento)}</b> ({numero(previa.data.vidaRestanteDias)} días de vida; vida útil {numero(previa.data.vidaUtilDias)} días).
            </p>
          )}
          {aviso && (
            <p role="alert" data-testid="aviso-costo" className={`flex items-start gap-2 rounded-lg p-3 text-sm sm:col-span-2 ${SEMAFORO[aviso.color].clase}`}>
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>Costo atípico (AL13 {SEMAFORO[aviso.color].texto.toLowerCase()}):</b> {aviso.mensaje} Si confirmas, se creará la alerta.
              </span>
            </p>
          )}
          <BotonPrimario type="submit" disabled={!valido} cargando={recibir.isPending} className="sm:col-span-2">
            Registrar recepción
          </BotonPrimario>
        </form>
      </Tarjeta>
      {r ? (
        <ResultadoOperacion
          titulo={`Recepción registrada: lote ${r.lote}`}
          detalles={[
            ['Cantidad', numero(r.cantidadInicial)],
            ['Costo unitario', dinero(r.costoUnitario)],
            ['Vencimiento', fecha(r.fechaVencimiento)],
            ['Movimiento', 'ENTRADA'],
          ]}
          cambioStock={`+${numero(r.cantidadInicial)} cajas en ${alm}`}
          efecto={r.efectoAlertas}
        />
      ) : (
        <Regla>Se valida que la ubicación pertenezca al almacén, que el costo sea mayor que cero y que el lote no esté vencido. Si el costo varía más del 10% (o 15%) frente a la capa anterior, se crea AL13.</Regla>
      )}
    </div>
  )
}
