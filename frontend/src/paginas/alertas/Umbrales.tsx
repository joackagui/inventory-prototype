import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../api/cliente'
import { useBitacora, useUmbralesDetalle } from '../../api/consultas'
import type { UmbralDetalle } from '../../api/tipos'
import { EstadoError } from '../../componentes/Estados'
import { Esqueleto, Tarjeta } from '../../componentes/Tarjeta'
import { fecha } from '../../utils/formato'

const NOMBRE_CAMPO: Record<string, string> = {
  rojoMultiploMax: 'Rojo (× Máx)',
  amarilloDias: 'Amarillo (días)',
  rojoDias: 'Rojo (días)',
  'frecuenciaDias.A': 'Frecuencia clase A (días)',
  'frecuenciaDias.B': 'Frecuencia clase B (días)',
  'frecuenciaDias.C': 'Frecuencia clase C (días)',
  rojoDiasExtra: 'Rojo (días extra)',
  amarilloPct: 'Amarillo (%)',
  rojoPct: 'Rojo (%)',
  amarilloHoras: 'Amarillo (horas)',
  rojoHoras: 'Rojo (horas)',
  amarilloDiasExtra: 'Amarillo (L + días)',
}

// En días que faltan (AL04, AL14) el amarillo llega antes con un número mayor; en el resto, con uno menor.
const MENOR_ES_PEOR = new Set(['AL04', 'AL14'])

type Plano = Record<string, number>
const aplanar = (o: UmbralDetalle['valor']): Plano =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? Object.entries(v).map(([s, n]) => [`${k}.${s}`, n]) : [[k, v]])))
const anidar = (p: Plano) =>
  Object.entries(p).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const [a, b] = k.split('.')
    if (b) acc[a] = { ...(acc[a] as object), [b]: v }
    else acc[a] = v
    return acc
  }, {})

// Validación en el navegador (el backend valida igual): números ≥ 0 y el amarillo antes que el rojo.
function errorUmbral(clave: string, p: Plano): string | null {
  if (Object.values(p).some((v) => !Number.isFinite(v) || v < 0)) return 'Usa números mayores o iguales a 0'
  if (clave === 'AL03' && !(p.rojoMultiploMax > 1)) return 'El rojo debe ser mayor que 1 × Máx'
  for (const k of Object.keys(p).filter((x) => x.startsWith('amarillo'))) {
    const a = p[k]
    const r = p[k.replace('amarillo', 'rojo')]
    if (r === undefined) continue
    if (MENOR_ES_PEOR.has(clave) ? !(a > r) : !(a < r)) return `El amarillo (${a}) debe dispararse antes que el rojo (${r})`
  }
  return null
}

function FilaUmbral({ u, editable, onGuardar }: { u: UmbralDetalle; editable: boolean; onGuardar: (clave: string, valor: Record<string, unknown>) => void }) {
  const actual = aplanar(u.valor)
  const defecto = aplanar(u.porDefecto)
  const [borrador, setBorrador] = useState<Record<string, string>>({})
  const valores: Plano = Object.fromEntries(Object.keys(actual).map((k) => [k, borrador[k] !== undefined ? Number(borrador[k]) : actual[k]]))
  const cambiado = Object.keys(actual).some((k) => valores[k] !== actual[k])
  const error = cambiado ? errorUmbral(u.clave, valores) : null
  const modificado = Object.keys(actual).some((k) => actual[k] !== defecto[k])
  return (
    <tr className="border-t border-borde align-top" data-testid={`umbral-${u.clave}`}>
      <th scope="row" className="py-3 pr-4 text-left font-normal">
        <span className="font-semibold">{u.clave}</span> <span className="text-suave">· {u.nombre}</span>
        {modificado && <span className="ml-2 rounded-full bg-amarillo-fondo px-2 py-0.5 text-xs font-semibold text-amarillo">Modificado</span>}
      </th>
      <td className="py-3">
        <div className="flex flex-wrap gap-3">
          {Object.keys(actual).map((k) => (
            <label key={k} className="flex flex-col text-xs text-suave">
              {NOMBRE_CAMPO[k] ?? k}
              <input
                type="number"
                step="any"
                min={0}
                disabled={!editable}
                className={clsx('num mt-1 w-28 rounded-lg border bg-superficie px-2 py-1.5 text-sm text-texto', error ? 'border-rojo' : 'border-borde')}
                value={borrador[k] ?? String(actual[k])}
                onChange={(e) => setBorrador({ ...borrador, [k]: e.target.value })}
                aria-label={`${u.clave} ${NOMBRE_CAMPO[k] ?? k}`}
              />
              <span className="num mt-0.5">por defecto {defecto[k]}</span>
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-sm text-rojo" role="alert">
            {error}
          </p>
        )}
      </td>
      {editable && (
        <td className="py-3 pl-4 text-right whitespace-nowrap">
          <button type="button" disabled={!cambiado || !!error} onClick={() => onGuardar(u.clave, anidar(valores))} className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-marca-texto disabled:opacity-40">
            <Save aria-hidden className="size-4" /> Guardar
          </button>
          {cambiado && (
            <button type="button" onClick={() => setBorrador({})} className="ml-2 inline-flex items-center gap-1 rounded-lg border border-borde px-2.5 py-2 text-sm" aria-label={`Descartar cambios de ${u.clave}`}>
              <RotateCcw aria-hidden className="size-4" />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

export function Umbrales({ editable, verBitacora }: { editable: boolean; verBitacora: boolean }) {
  const consulta = useUmbralesDetalle()
  const bitacora = useBitacora(verBitacora)
  const [confirmar, setConfirmar] = useState<{ clave: string; valor: Record<string, unknown> } | null>(null)
  const guardar = useMutation({
    mutationFn: (c: { clave: string; valor: Record<string, unknown> }) => api(`/alertas/umbrales/${c.clave}`, { metodo: 'PUT', cuerpo: { valor: c.valor } }),
    onSuccess: (_, c) => {
      toast.success(`Umbral ${c.clave} guardado`, { description: 'Las alertas se reevaluaron con el nuevo valor.' })
      setConfirmar(null)
    },
  })
  const cambios = (bitacora.data ?? []).filter((b) => b.entidadId === 'umbralesAlertas').slice(0, 5)
  return (
    <div className="space-y-6">
      <Tarjeta titulo="Umbrales de las alertas" subtitulo={editable ? 'Edita y guarda cada alerta por separado; el amarillo siempre se dispara antes que el rojo.' : 'Solo lectura para tu rol.'}>
        {consulta.isPending ? (
          <Esqueleto className="h-96" />
        ) : consulta.isError ? (
          <EstadoError error={consulta.error} reintentar={() => consulta.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Umbrales por alerta</caption>
              <tbody>
                {consulta.data.map((u) => (
                  <FilaUmbral key={`${u.clave}-${JSON.stringify(u.valor)}`} u={u} editable={editable} onGuardar={(clave, valor) => setConfirmar({ clave, valor })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {verBitacora && (
        <Tarjeta titulo="Cambios recientes" subtitulo="Bitácora de umbrales">
          {cambios.length ? (
            <ul className="space-y-2 text-sm">
              {cambios.map((c) => {
                const antes = (c.valorAnterior ?? {}) as Record<string, unknown>
                const despues = (c.valorNuevo ?? {}) as Record<string, unknown>
                const claves = Object.keys(despues).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
                return (
                  <li key={c.id} className="rounded-lg bg-superficie-2 px-3 py-2">
                    <span className="font-semibold">{c.usuario?.codigo}</span> · {fecha(c.fechaOperacion)} · cambió {claves.join(', ') || 'umbrales'}:{' '}
                    {claves.map((k) => (
                      <span key={k} className="num text-suave">
                        {JSON.stringify(antes[k])} → {JSON.stringify(despues[k])}{' '}
                      </span>
                    ))}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-suave">Sin cambios de umbrales registrados.</p>
          )}
        </Tarjeta>
      )}
      <Dialog.Root open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="entrar fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borde bg-superficie p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold">¿Guardar el umbral {confirmar?.clave}?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-suave">El cambio queda en la bitácora y todas las alertas se reevalúan de inmediato.</Dialog.Description>
            <pre className="num mt-3 rounded-lg bg-superficie-2 p-3 text-sm">{JSON.stringify(confirmar?.valor, null, 1)}</pre>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close className="rounded-lg border border-borde px-4 py-2 font-medium">Cancelar</Dialog.Close>
              <button type="button" onClick={() => confirmar && guardar.mutate(confirmar)} disabled={guardar.isPending} className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto">
                Confirmar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
