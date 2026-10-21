import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Pencil } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../api/cliente'
import type { ParametrosArticulo, ResumenAlmacenArticulo } from '../../api/tipos'
import { decimal, numero, porcentaje } from '../../utils/formato'

// Las fórmulas con los números reales que devuelve el backend (la ficha no recalcula nada).
function Formulas({ p }: { p: ParametrosArticulo }) {
  const lineas = [
    `SS = Z × σd × √L = ${decimal(p.z)} × ${decimal(p.desviacionDemanda)} × √${p.leadTimeDias} = ${numero(p.stockSeguridad)}`,
    `ROP = d × L + SS = ${numero(p.demandaDiaria)} × ${p.leadTimeDias} + ${numero(p.stockSeguridad)} = ${numero(p.rop)}`,
    `Q = d × días de revisión = ${numero(p.demandaDiaria)} × ${p.diasRevision} = ${numero(p.loteTraslado)}`,
    `Máx = ROP + Q = ${numero(p.rop)} + ${numero(p.loteTraslado)} = ${numero(p.stockMaximo)}`,
  ]
  return (
    <ol className="num space-y-1 rounded-xl bg-superficie-2 p-4 font-mono text-sm" aria-label="Fórmulas">
      {lineas.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ol>
  )
}

const COLUMNAS: [keyof ParametrosArticulo, string, (v: number) => string][] = [
  ['demandaDiaria', 'd', (v) => numero(v)],
  ['desviacionDemanda', 'σd', decimal],
  ['leadTimeDias', 'L', (v) => numero(v)],
  ['nivelServicio', 'Nivel de servicio', (v) => porcentaje(v * 100, 0)],
  ['z', 'Z', (v) => numero(v, 2)],
  ['stockSeguridad', 'SS', (v) => numero(v)],
  ['rop', 'ROP', (v) => numero(v)],
  ['loteTraslado', 'Q', (v) => numero(v)],
  ['stockMaximo', 'Máx', (v) => numero(v)],
]

export function SeccionParametros({ codigo, almacenes, editable }: { codigo: string; almacenes: ResumenAlmacenArticulo[]; editable: boolean }) {
  const [editando, setEditando] = useState<ResumenAlmacenArticulo | null>(null)
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Parámetros de reposición por almacén</caption>
          <thead>
            {/* Sin mayúsculas: σd y d son símbolos de las fórmulas. */}
            <tr className="text-left text-xs font-semibold tracking-wide text-suave">
              <th scope="col" className="pb-2">
                Almacén
              </th>
              <th scope="col" className="pb-2">
                Clase
              </th>
              {COLUMNAS.map(([, t]) => (
                <th key={t} scope="col" className="pb-2 text-right">
                  {t}
                </th>
              ))}
              {editable && <th scope="col" className="sr-only">Editar</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {almacenes.map((a) => (
              <tr key={a.almacen} data-testid={`parametros-${a.almacen}`}>
                <th scope="row" className="py-2.5 text-left font-semibold">
                  {a.nombre}
                </th>
                <td className="py-2.5">{a.parametros!.claseAbc}</td>
                {COLUMNAS.map(([k, t, f]) => (
                  <td key={t} className={clsx('num py-2.5 text-right', ['rop', 'stockSeguridad', 'stockMaximo'].includes(k) && 'font-bold')} data-param={k}>
                    {f(a.parametros![k] as number)}
                  </td>
                ))}
                {editable && (
                  <td className="py-2.5 pl-3 text-right">
                    <button type="button" onClick={() => setEditando(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-borde px-2.5 py-1.5 font-semibold hover:bg-superficie-2" aria-label={`Editar parámetros de ${a.nombre}`}>
                      <Pencil aria-hidden className="size-4" /> Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 2xl:grid-cols-3">
        {almacenes.map((a) => (
          <div key={a.almacen} data-testid={`formulas-${a.almacen}`}>
            <h4 className="mb-1.5 text-sm font-semibold">{a.nombre}</h4>
            <Formulas p={a.parametros!} />
          </div>
        ))}
      </div>
      {editando && <DialogoParametros codigo={codigo} almacen={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

const NIVELES = [0.9, 0.95, 0.98, 0.99]

function DialogoParametros({ codigo, almacen, onCerrar }: { codigo: string; almacen: ResumenAlmacenArticulo; onCerrar: () => void }) {
  const p = almacen.parametros!
  const [valores, setValores] = useState({ demandaDiaria: String(p.demandaDiaria), desviacionDemanda: String(p.desviacionDemanda), leadTimeDias: String(p.leadTimeDias), claseAbc: p.claseAbc, nivelServicio: String(p.nivelServicio) })
  const [confirmando, setConfirmando] = useState(false)
  const cuerpo = { demandaDiaria: Number(valores.demandaDiaria), desviacionDemanda: Number(valores.desviacionDemanda), leadTimeDias: Number(valores.leadTimeDias), claseAbc: valores.claseAbc, nivelServicio: Number(valores.nivelServicio) }
  const diferido = useDeferredValue(JSON.stringify(cuerpo))
  // Vista previa en vivo: el backend calcula con las mismas fórmulas, sin guardar.
  const vista = useQuery({
    queryKey: ['simular', codigo, almacen.almacen, diferido],
    queryFn: () => api<{ simulado: ParametrosArticulo }>(`/parametros/${codigo}/${almacen.almacen}/simular`, { metodo: 'POST', cuerpo: JSON.parse(diferido) }),
    retry: false,
  })
  const guardar = useMutation({
    mutationFn: () => api(`/parametros/${codigo}/${almacen.almacen}`, { metodo: 'PUT', cuerpo }),
    onSuccess: () => {
      toast.success(`Parámetros de ${codigo} en ${almacen.nombre} guardados`, { description: 'Se recalcularon SS, ROP, Q y Máx y se reevaluaron las alertas.' })
      onCerrar()
    },
  })
  const s = vista.data?.simulado
  const campo = 'num mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2'
  const fijar = (k: keyof typeof valores) => (e: { target: { value: string } }) => {
    setConfirmando(false)
    setValores({ ...valores, [k]: e.target.value })
  }
  const filas: [keyof ParametrosArticulo, string, number][] = [
    ['z', 'Z', 2],
    ['stockSeguridad', 'SS', 0],
    ['rop', 'ROP', 0],
    ['loteTraslado', 'Q', 0],
    ['stockMaximo', 'Máx', 0],
  ]
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="entrar fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-borde bg-superficie p-6 shadow-2xl" data-testid="dialogo-parametros">
          <Dialog.Title className="text-xl font-semibold">
            Parámetros de {codigo} · {almacen.nombre}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-suave">La vista previa se calcula en el backend con cada cambio; nada se guarda hasta que confirmes.</Dialog.Description>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label>
                Demanda diaria d<input className={campo} type="number" min={0} value={valores.demandaDiaria} onChange={fijar('demandaDiaria')} aria-label="Demanda diaria d" />
              </label>
              <label>
                Desviación σd<input className={campo} type="number" min={0} step="0.01" value={valores.desviacionDemanda} onChange={fijar('desviacionDemanda')} aria-label="Desviación σd" />
              </label>
              <label>
                Lead time L (días)<input className={campo} type="number" min={1} value={valores.leadTimeDias} onChange={fijar('leadTimeDias')} aria-label="Lead time L" />
              </label>
              <label>
                Clase ABC
                <select className={campo} value={valores.claseAbc} onChange={fijar('claseAbc')} aria-label="Clase ABC">
                  {['A', 'B', 'C'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2">
                Nivel de servicio
                <select className={campo} value={valores.nivelServicio} onChange={fijar('nivelServicio')} aria-label="Nivel de servicio">
                  {[...new Set([...NIVELES, p.nivelServicio])].sort().map((n) => (
                    <option key={n} value={n}>
                      {porcentaje(n * 100, 0)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <table className="w-full text-sm" data-testid="vista-previa">
                <caption className="mb-2 text-left font-semibold">Vista previa</caption>
                <thead>
                  <tr className="text-xs text-suave">
                    <th className="text-left" scope="col">
                      Parámetro
                    </th>
                    <th className="text-right" scope="col">
                      Actual
                    </th>
                    <th className="text-right" scope="col">
                      Nuevo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(([k, t, dec]) => {
                    const nuevo = s?.[k] as number | undefined
                    const cambia = nuevo !== undefined && nuevo !== p[k]
                    return (
                      <tr key={k} className="border-t border-borde" data-preview={k}>
                        <th scope="row" className="py-1.5 text-left font-semibold">
                          {t}
                        </th>
                        <td className="num py-1.5 text-right text-suave">{numero(p[k] as number, dec)}</td>
                        <td className={clsx('num py-1.5 text-right font-bold', cambia && 'text-acento')} data-nuevo={k}>
                          {nuevo === undefined ? '…' : numero(nuevo, dec)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {vista.isError && <p className="mt-2 text-sm text-rojo">Revisa los valores: {(vista.error as Error).message}</p>}
              {s && (
                <div className="mt-3">
                  <Formulas p={s} />
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            {confirmando && <p className="mr-auto text-sm text-amarillo">¿Confirmas? Se guardará en la bitácora y se reevaluarán las alertas.</p>}
            <Dialog.Close className="rounded-lg border border-borde px-4 py-2 font-medium">Cancelar</Dialog.Close>
            <button type="button" disabled={!s || guardar.isPending} onClick={() => (confirmando ? guardar.mutate() : setConfirmando(true))} className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto disabled:opacity-50">
              {confirmando ? 'Confirmar y guardar' : 'Guardar cambios'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
