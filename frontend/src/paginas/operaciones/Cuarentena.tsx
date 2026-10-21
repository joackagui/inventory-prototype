import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api } from '../../api/cliente'
import { useCapasFiltro } from '../../api/consultas'
import type { CapaListada, ConEfecto } from '../../api/tipos'
import { EstadoVacio } from '../../componentes/Estados'
import { BotonPrimario, Campo, campo, Regla } from '../../componentes/Formulario'
import { ResultadoOperacion } from '../../componentes/ResultadoOperacion'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { VidaRestante } from '../../componentes/VidaRestante'
import { fecha, numero } from '../../utils/formato'
import { SelectorAlmacenOperacion, useAlmacenOperacion } from './comun'

export function Cuarentena() {
  const { fijo, inicial, rol } = useAlmacenOperacion()
  const [almacen, setAlmacen] = useState(inicial)
  const alm = fijo ?? almacen
  const disponibles = useCapasFiltro({ almacen: alm, estado: 'DISPONIBLE' })
  const enCuarentena = useCapasFiltro({ almacen: alm, estado: 'CUARENTENA' })
  const [capa, setCapa] = useState<CapaListada | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<{ titulo: string; detalles: [string, string][]; efecto: ConEfecto['efectoAlertas']; nota?: string } | null>(null)
  const mover = useMutation({
    mutationFn: () => api<CapaListada & ConEfecto>('/cuarentena', { metodo: 'POST', cuerpo: { capaId: capa!.id, cantidad: Number(cantidad), motivo } }),
    onSuccess: (r) => {
      setResultado({ titulo: `Capa ${r.lote} en cuarentena`, detalles: [['Cantidad', numero(Number(cantidad))], ['Ubicación', 'CUAR-01'], ['Estado', 'CUARENTENA']], efecto: r.efectoAlertas, nota: Number(cantidad) < capa!.cantidadRestante ? 'Movimiento parcial: la capa se dividió (mismo lote, costo y vencimiento).' : 'La capa completa pasó a CUAR-01.' })
      setCapa(null)
    },
  })
  const liberar = useMutation({
    mutationFn: (c: CapaListada) => api<CapaListada & ConEfecto>(`/cuarentena/${c.id}/liberar`, { metodo: 'POST' }),
    onSuccess: (r) => setResultado({ titulo: `Capa ${r.lote} liberada`, detalles: [['Cantidad', numero(r.cantidadRestante)], ['Estado', 'DISPONIBLE']], efecto: r.efectoAlertas, nota: 'Vuelve a su ubicación de picking y se puede vender.' }),
  })
  const merma = useMutation({
    mutationFn: (c: CapaListada) => api<{ id: number } & ConEfecto>('/ajustes', { metodo: 'POST', cuerpo: { almacen: c.almacen.codigo, articulo: c.articulo.codigo, cantidad: -c.cantidadRestante, motivo: 'VENCIMIENTO', capaId: c.id, observacion: 'Baja de capa en cuarentena' } }),
    onSuccess: (r, c) => setResultado({ titulo: `Merma de ${c.lote} registrada (ajuste #${r.id})`, detalles: [['Cantidad', numero(-c.cantidadRestante)], ['Estado', 'PENDIENTE']], efecto: r.efectoAlertas, nota: 'R07 la aprueba en Aprobaciones; quien la registra no puede aprobarla.' }),
  })
  // Sugeridas primero: capas con menos de 15 días de vida (ya no se despachan).
  const lista = [...(disponibles.data ?? [])].sort((a, b) => Number(b.vidaRestanteDias < 15) - Number(a.vidaRestanteDias < 15))
  const n = Number(cantidad)
  const valida = capa && Number.isInteger(n) && n > 0 && n <= capa.cantidadRestante && motivo
  return (
    <div className="space-y-6">
      {resultado && <ResultadoOperacion titulo={resultado.titulo} detalles={resultado.detalles} cambioStock={resultado.nota} efecto={resultado.efecto} />}
      <div className="grid gap-6 2xl:grid-cols-2">
        <Tarjeta titulo="Pasar a cuarentena" subtitulo="La capa no se vende ni se despacha mientras esté en CUAR-01" acciones={<SelectorAlmacenOperacion valor={almacen} onCambiar={setAlmacen} fijo={fijo} />}>
          {disponibles.isPending ? (
            <Esqueleto className="h-48" />
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto" data-testid="capas-disponibles">
              {lista.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCapa(c)
                      setCantidad(String(c.cantidadRestante))
                      setMotivo(c.vidaRestanteDias < 15 ? 'Vence en menos de 15 días' : '')
                    }}
                    className={clsx('grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-3 text-left text-sm', capa?.id === c.id ? 'border-acento ring-2 ring-acento' : 'border-borde')}
                    data-lote={c.lote}
                  >
                    <span>
                      <b>{c.lote}</b> · {c.articulo.codigo} · {numero(c.cantidadRestante)} u. · vence {fecha(c.fechaVencimiento)}
                      {c.vidaRestanteDias < 15 && <span className="ml-2 rounded-full bg-rojo-fondo px-2 py-0.5 text-xs font-bold text-rojo">Sugerida</span>}
                    </span>
                    <VidaRestante dias={c.vidaRestanteDias} vidaUtil={180} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {capa && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (valida) mover.mutate()
              }}
            >
              <Campo etiqueta={`Cantidad (de ${numero(capa.cantidadRestante)})`} error={n > capa.cantidadRestante ? 'No puede superar el saldo de la capa' : null} ayuda={n > 0 && n < capa.cantidadRestante ? 'Movimiento parcial: la capa se divide' : undefined}>
                <input className={campo} type="number" min={1} max={capa.cantidadRestante} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-label="Cantidad a cuarentena" />
              </Campo>
              <Campo etiqueta="Motivo">
                <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo de cuarentena" />
              </Campo>
              <BotonPrimario type="submit" disabled={!valida} cargando={mover.isPending} className="sm:col-span-2">
                Mover a CUAR-01
              </BotonPrimario>
            </form>
          )}
        </Tarjeta>
        <Tarjeta titulo="En cuarentena" subtitulo="R07 libera la capa; para darla de baja se registra una merma que aprueba R07">
          {!enCuarentena.data?.length ? (
            <EstadoVacio titulo="No hay capas en cuarentena" />
          ) : (
            <ul className="space-y-2" data-testid="capas-cuarentena">
              {enCuarentena.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde p-3 text-sm" data-lote={c.lote}>
                  <span>
                    <b>{c.lote}</b> · {c.articulo.codigo} · {numero(c.cantidadRestante)} u. · {c.vidaRestanteDias} días de vida
                  </span>
                  <span className="space-x-2">
                    {rol === 'R07' && (
                      <button type="button" disabled={liberar.isPending} onClick={() => liberar.mutate(c)} className="rounded-lg bg-marca px-3 py-1.5 font-semibold text-marca-texto disabled:opacity-50">
                        Liberar
                      </button>
                    )}
                    <button type="button" disabled={merma.isPending} onClick={() => merma.mutate(c)} className="rounded-lg border border-borde px-3 py-1.5 font-semibold disabled:opacity-50">
                      Enviar a merma
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Regla>Las capas con menos de 15 días de vida ya no se despachan: aparecen sugeridas para cuarentena.</Regla>
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}
