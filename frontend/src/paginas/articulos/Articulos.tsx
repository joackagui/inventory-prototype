import { CircleCheck, CircleX, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAlmacenes, useEstadoArticulos, useUsuarioActual } from '../../api/consultas'
import { EstadoError, EstadoVacio } from '../../componentes/Estados'
import { Semaforo } from '../../componentes/Semaforo'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { dinero, numero } from '../../utils/formato'

const campo = 'rounded-lg border border-borde bg-superficie px-3 py-2 text-sm'

export function Articulos() {
  const consulta = useEstadoArticulos()
  const { data: almacenes = [] } = useAlmacenes()
  const { rol } = useUsuarioActual()
  const [busqueda, setBusqueda] = useState('')
  const [clase, setClase] = useState('')
  const [familia, setFamilia] = useState('')
  const preventista = rol === 'R01'
  const filas = (consulta.data ?? []).filter(
    (f) => (!busqueda || `${f.codigo} ${f.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())) && (!clase || f.claseAbc === clase) && (!familia || f.familia === familia),
  )
  const familias = [...new Set((consulta.data ?? []).map((f) => f.familia))]
  return (
    <div className="space-y-6">
      <div className="entrar">
        <h1 className="text-3xl font-bold tracking-tight">Artículos</h1>
        <p className="mt-1 text-suave">{preventista ? 'Disponibilidad por almacén' : 'Maestro MD2 con el estado de cada almacén'}</p>
      </div>
      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-suave">
            Buscar
            <span className="relative">
              <Search aria-hidden className="absolute top-2.5 left-2.5 size-4" />
              <input type="search" className={`${campo} w-64 pl-8`} placeholder="Código o descripción" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar artículo" />
            </span>
          </label>
          {!preventista && (
            <label className="flex flex-col gap-1 text-xs font-medium text-suave">
              Clase ABC
              <select className={campo} value={clase} onChange={(e) => setClase(e.target.value)} aria-label="Clase ABC">
                <option value="">Todas</option>
                {['A', 'B', 'C'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-suave">
            Familia
            <select className={campo} value={familia} onChange={(e) => setFamilia(e.target.value)} aria-label="Familia">
              <option value="">Todas</option>
              {familias.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
        {consulta.isPending ? (
          <Esqueleto className="h-80" />
        ) : consulta.isError ? (
          <EstadoError error={consulta.error} reintentar={() => consulta.refetch()} />
        ) : !filas.length ? (
          <EstadoVacio titulo="Ningún artículo coincide" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">Artículos</caption>
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-suave uppercase">
                  <th scope="col" className="pb-3">
                    Artículo
                  </th>
                  {!preventista && (
                    <>
                      <th scope="col" className="pb-3">
                        Clase
                      </th>
                      <th scope="col" className="pb-3 text-right">
                        Precio
                      </th>
                      <th scope="col" className="pb-3 text-right">
                        Vida útil
                      </th>
                      <th scope="col" className="pb-3 text-right">
                        Vendible total
                      </th>
                    </>
                  )}
                  <th scope="col" className="pb-3 pl-6">
                    {preventista ? 'Disponibilidad' : 'Estado por almacén'}
                  </th>
                  {!preventista && (
                    <>
                      <th scope="col" className="pb-3 text-right">
                        Cobertura mín.
                      </th>
                      <th scope="col" className="pb-3 text-right">
                        Alertas
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((f) => (
                  <tr key={f.codigo} className="entrar">
                    <th scope="row" className="py-3 font-normal">
                      <Link to={`/articulos/${f.codigo}`} className="num font-semibold text-acento hover:underline">
                        {f.codigo}
                      </Link>
                      <span className="block text-sm text-suave">{f.descripcion}</span>
                    </th>
                    {!preventista && (
                      <>
                        <td className="py-3">
                          <span className="rounded-md bg-marca px-2 py-0.5 text-sm font-bold text-marca-texto">{f.claseAbc}</span>
                        </td>
                        <td className="num py-3 text-right">{dinero(f.precio)}</td>
                        <td className="num py-3 text-right">{numero(f.vidaUtilDias)} días</td>
                        <td className="num py-3 text-right font-semibold">{numero(f.vendibleTotal)}</td>
                      </>
                    )}
                    <td className="py-3 pl-6">
                      <span className="flex flex-wrap gap-3">
                        {f.almacenes.map((a) => {
                          const nombre = almacenes.find((x) => x.codigo === a.almacen)?.corto ?? a.almacen
                          if (preventista) {
                            const hay = a.estado === 'DISPONIBLE'
                            const Icono = hay ? CircleCheck : CircleX
                            return (
                              <span key={a.almacen} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${hay ? 'bg-verde-fondo text-verde' : 'bg-rojo-fondo text-rojo'}`}>
                                <Icono aria-hidden className="size-4" /> {nombre}: {hay ? 'Disponible' : 'Agotado'}
                              </span>
                            )
                          }
                          return (
                            <span key={a.almacen} className="inline-flex items-center gap-1.5 text-sm" title={a.alertas?.join(' ') || 'Sin alertas'}>
                              <Semaforo color={a.color!} compacto />
                              <span className="font-semibold">{nombre}</span>
                            </span>
                          )
                        })}
                      </span>
                    </td>
                    {!preventista && (
                      <>
                        <td className="num py-3 text-right">{numero(f.coberturaMinimaDias, 1)} días</td>
                        <td className="num py-3 text-right">{numero(f.alertasVigentes)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
