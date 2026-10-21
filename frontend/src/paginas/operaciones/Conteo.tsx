import { useMutation } from '@tanstack/react-query'
import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/cliente'
import { useAlertas, useUbicaciones } from '../../api/consultas'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Semaforo } from '../../componentes/Semaforo'
import { Tarjeta } from '../../componentes/Tarjeta'
import { numero, porcentaje } from '../../utils/formato'
import { SelectorAlmacenOperacion, SelectorArticulo, useAlmacenOperacion } from './comun'

interface RespuestaConteo {
  conteo: { cantidadSistema: number; cantidadContada: number; diferencia: number; porcentaje: number; requiereRecuento: boolean }
  ajuste: { id: number } | null
  toleranciaPct: number
  efectoAlertas?: import('../../api/tipos').EfectoAlertas
}

export function Conteo() {
  const { fijo, inicial, params } = useAlmacenOperacion()
  const [tipo, setTipo] = useState('CICLICO')
  const [almacen, setAlmacen] = useState(inicial)
  const [articulo, setArticulo] = useState(params.get('articulo') ?? '')
  const [ubicacion, setUbicacion] = useState('')
  const [contada, setContada] = useState('')
  const alm = fijo ?? almacen
  const ubicaciones = useUbicaciones(alm).data ?? []
  const atrasados = useAlertas('codigo=AL05&estado=VIGENTE&tamano=100').data?.datos ?? []
  const contar = useMutation({ mutationFn: () => api<RespuestaConteo>('/conteos', { metodo: 'POST', cuerpo: { tipo, almacen: alm, ubicacion: ubicacion || ubicaciones[0]?.codigo, articulo, cantidadContada: Number(contada) } }) })
  const error = contada && !(Number.isInteger(Number(contada)) && Number(contada) >= 0) ? 'Debe ser un número entero mayor o igual a 0' : null
  const r = contar.data
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <div className="space-y-6">
        <Tarjeta titulo="Conteo físico" subtitulo="Conteo ciego: la cantidad del sistema se muestra solo después de registrar">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!error && articulo && contada) contar.mutate()
            }}
          >
            <Campo etiqueta="Tipo">
              <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de conteo">
                <option value="CICLICO">Cíclico</option>
                <option value="GENERAL">General</option>
              </select>
            </Campo>
            <Campo etiqueta="Almacén">
              <SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} fijo={fijo} />
            </Campo>
            <Campo etiqueta="Artículo">
              <SelectorArticulo
                valor={articulo}
                onCambiar={(a) => {
                  setArticulo(a)
                  contar.reset()
                }}
              />
            </Campo>
            <Campo etiqueta="Ubicación">
              <select className={campo} value={ubicacion || ubicaciones[0]?.codigo || ''} onChange={(e) => setUbicacion(e.target.value)} aria-label="Ubicación">
                {ubicaciones.map((u) => (
                  <option key={u.codigo} value={u.codigo}>
                    {u.codigo} · {u.descripcion}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Cantidad contada" error={error} className="sm:col-span-2">
              <input className={campo} type="number" min={0} value={contada} onChange={(e) => setContada(e.target.value)} aria-label="Cantidad contada" />
            </Campo>
            <p className="flex items-center gap-2 text-sm text-suave sm:col-span-2">
              <EyeOff aria-hidden className="size-4" /> Control interno: no se muestra el saldo del sistema antes de contar.
            </p>
            <BotonPrimario type="submit" disabled={!articulo || !contada || !!error} cargando={contar.isPending} className="sm:col-span-2">
              Registrar conteo
            </BotonPrimario>
          </form>
        </Tarjeta>
        <Tarjeta titulo="Conteos atrasados" subtitulo="Según la clase: A cada 30 días, B cada 90, C cada 180 (alerta AL05)">
          {atrasados.length ? (
            <ul className="space-y-2" data-testid="conteos-atrasados">
              {atrasados.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Semaforo color={a.color} compacto />
                    <b>{a.articulo?.codigo}</b> {a.almacen?.codigo} · {a.mensaje}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg border border-borde px-3 py-1.5 font-semibold"
                    onClick={() => {
                      setArticulo(a.articulo!.codigo)
                      if (!fijo && a.almacen) setAlmacen(a.almacen.codigo)
                      contar.reset()
                    }}
                  >
                    Contar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">No hay conteos atrasados.</p>
          )}
        </Tarjeta>
      </div>
      {r ? (
        <ResultadoOperacion
          titulo={r.conteo.diferencia ? 'Conteo registrado con diferencia' : 'Conteo registrado sin diferencia'}
          detalles={[
            ['Sistema', numero(r.conteo.cantidadSistema)],
            ['Contado', numero(r.conteo.cantidadContada)],
            ['Diferencia', numero(r.conteo.diferencia)],
            ['Porcentaje', porcentaje(r.conteo.porcentaje, 2)],
            ['Tolerancia', porcentaje(r.toleranciaPct, 1)],
            ['¿Requiere recuento?', r.conteo.requiereRecuento ? 'Sí, supera la tolerancia' : 'No'],
          ]}
          cambioStock={r.ajuste ? 'El stock no cambia hasta que R07 apruebe el ajuste.' : 'Se actualizó la fecha del último conteo.'}
          efecto={r.efectoAlertas}
          acciones={
            r.ajuste && (
              <Link to={`/aprobaciones?ajuste=${r.ajuste.id}`} className="inline-block rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto" data-testid="enlace-ajuste">
                Ver ajuste pendiente #{r.ajuste.id}
              </Link>
            )
          }
        />
      ) : (
        <Regla>Si hay diferencia se crea un ajuste PENDIENTE de aprobación (R07). Si el porcentaje supera la tolerancia (0.5%), el conteo queda marcado para recuento.</Regla>
      )}
    </div>
  )
}
