import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../api/cliente'
import { useAlertas, useNombreAlmacen, useResumenAlertasAlmacen, useUsuarioActual, useUsuarios } from '../../api/consultas'
import type { Alerta } from '../../api/tipos'
import { EstadoError, EstadoVacio } from '../../componentes/Estados'
import { Esqueleto } from '../../componentes/Tarjeta'
import { useSesion } from '../../sesion/Sesion'
import { numero } from '../../utils/formato'
import { FilaAlerta } from './FilaAlerta'
import { aParametros, type Filtros, FILTROS_INICIALES, FiltrosAlertas } from './FiltrosAlertas'
import { PanelAlerta } from './PanelAlerta'
import { Umbrales } from './Umbrales'

type Pildora = { clave: string; texto: string; valor: number | undefined; aplicar: Partial<Filtros>; clase: string }

export function CentroAlertas() {
  const { almacen } = useSesion()
  const { rol } = useUsuarioActual()
  const { data: usuarios } = useUsuarios()
  const nombreAlmacen = useNombreAlmacen()
  const [pestana, setPestana] = useState<'alertas' | 'umbrales'>('alertas')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [atendidas, setAtendidas] = useState<Set<number>>(new Set())
  const resumen = useResumenAlertasAlmacen(almacen)
  const lista = useAlertas(aParametros(filtros, almacen))
  const verUmbrales = rol === 'R07' || rol === 'R08' || rol === 'R09'

  const evaluar = useMutation({
    mutationFn: () => api<{ creadas: number; cambiosColor: number; resueltas: number; escaladas: number; abiertas: number }>('/alertas/evaluar', { metodo: 'POST' }),
    onSuccess: (r) => toast.success(`Evaluación completa: ${r.creadas + r.cambiosColor + r.resueltas} alertas cambiaron`, { description: `${r.creadas} nuevas · ${r.cambiosColor} de color · ${r.resueltas} resueltas · ${r.escaladas} escaladas · ${r.abiertas} vigentes` }),
  })

  const roles = useMemo(() => [...new Map((usuarios ?? []).map((u) => [u.rol.codigo, { codigo: u.rol.codigo, nombre: u.rol.nombre }])).values()].filter((r) => r.codigo !== 'R01'), [usuarios])

  // Búsqueda de artículo y agrupación: solo presentación sobre la lista que devuelve la API.
  const busqueda = filtros.busqueda.trim().toUpperCase()
  const visibles = (lista.data?.datos ?? []).filter((a) => !busqueda || a.articulo?.codigo.includes(busqueda) || a.mensaje.toUpperCase().includes(busqueda))
  const grupos = useMemo(() => {
    if (filtros.agrupar === 'ninguno') return [{ titulo: '', alertas: visibles }]
    const clave = (a: Alerta) => (filtros.agrupar === 'codigo' ? `${a.codigo} · ${a.nombre}` : filtros.agrupar === 'almacen' ? nombreAlmacen(a.almacen?.codigo) : (a.articulo?.codigo ?? 'Sin artículo'))
    const mapa = new Map<string, Alerta[]>()
    for (const a of visibles) mapa.set(clave(a), [...(mapa.get(clave(a)) ?? []), a])
    return [...mapa].map(([titulo, alertas]) => ({ titulo, alertas }))
  }, [visibles, filtros.agrupar, nombreAlmacen])

  const r = resumen.data
  const pildoras: Pildora[] = [
    { clave: 'vigentes', texto: 'vigentes', valor: r?.total, aplicar: { estado: 'VIGENTE', color: '', rapido: '' }, clase: 'bg-superficie' },
    { clave: 'rojas', texto: 'rojas', valor: r?.porColor.ROJO, aplicar: { estado: 'VIGENTE', color: 'ROJO', rapido: '' }, clase: 'bg-rojo-fondo text-rojo' },
    { clave: 'amarillas', texto: 'amarillas', valor: r?.porColor.AMARILLO, aplicar: { estado: 'VIGENTE', color: 'AMARILLO', rapido: '' }, clase: 'bg-amarillo-fondo text-amarillo' },
    { clave: 'azules', texto: 'azules', valor: r?.porColor.AZUL, aplicar: { estado: 'VIGENTE', color: 'AZUL', rapido: '' }, clase: 'bg-azul-fondo text-azul' },
    { clave: 'sinAtender', texto: 'sin atender', valor: r?.sinAtender, aplicar: { color: '', rapido: 'sinAtender' }, clase: 'bg-superficie' },
    { clave: 'escaladas', texto: 'escaladas', valor: r?.escaladas, aplicar: { estado: 'VIGENTE', color: '', rapido: 'escaladas' }, clase: 'bg-marca text-marca-texto' },
  ]
  const activa = (p: Pildora) => Object.entries(p.aplicar).every(([k, v]) => filtros[k as keyof Filtros] === v)

  return (
    <div className="space-y-6">
      <div className="entrar flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de alertas</h1>
          <p className="mt-1 text-suave">{almacen === 'TODOS' ? 'Los 3 almacenes' : nombreAlmacen(almacen)} · semáforo AL01–AL16 con la fecha simulada</p>
        </div>
        {(rol === 'R07' || rol === 'R09') && (
          <button type="button" onClick={() => evaluar.mutate()} disabled={evaluar.isPending} className="inline-flex items-center gap-2 rounded-xl bg-marca px-4 py-2.5 font-semibold text-marca-texto hover:bg-marca-2 disabled:opacity-60">
            <RefreshCw aria-hidden className={clsx('size-4', evaluar.isPending && 'animate-spin')} /> Evaluar ahora
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos">
        {pildoras.map((p) => (
          <button key={p.clave} type="button" aria-pressed={activa(p)} onClick={() => setFiltros({ ...filtros, ...p.aplicar })} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold shadow-tarjeta transition', p.clase, activa(p) && 'ring-2 ring-acento')} data-testid={`pildora-${p.clave}`}>
            <span className="num">{p.valor === undefined ? '…' : numero(p.valor)}</span> {p.texto}
          </button>
        ))}
      </div>

      {verUmbrales && (
        <div role="tablist" aria-label="Secciones del centro de alertas" className="flex gap-1 border-b border-borde">
          {(['alertas', 'umbrales'] as const).map((p) => (
            <button key={p} role="tab" aria-selected={pestana === p} onClick={() => setPestana(p)} className={clsx('-mb-px border-b-2 px-4 py-2 font-semibold', pestana === p ? 'border-acento text-acento' : 'border-transparent text-suave hover:text-texto')}>
              {p === 'alertas' ? 'Alertas' : 'Umbrales'}
            </button>
          ))}
        </div>
      )}

      {pestana === 'umbrales' && verUmbrales ? (
        <Umbrales editable={rol === 'R07'} verBitacora={rol === 'R07' || rol === 'R09'} />
      ) : (
        <>
          <FiltrosAlertas valor={filtros} onCambiar={setFiltros} roles={roles} />
          {lista.isPending ? (
            <Esqueleto className="h-96" />
          ) : lista.isError ? (
            <EstadoError error={lista.error} reintentar={() => lista.refetch()} />
          ) : visibles.length === 0 ? (
            <EstadoVacio titulo="No hay alertas con estos filtros">Prueba con otro estado, color o tipo de alerta.</EstadoVacio>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-suave" aria-live="polite">
                <span className="num font-semibold text-texto" data-testid="total-alertas">
                  {visibles.length}
                </span>{' '}
                alertas
              </p>
              {grupos.map((g) => (
                <section key={g.titulo || 'todas'} aria-label={g.titulo || 'Alertas'}>
                  {g.titulo && (
                    <h2 className="mb-2 font-semibold">
                      {g.titulo} <span className="num text-suave">({g.alertas.length})</span>
                    </h2>
                  )}
                  <ul className="space-y-2">
                    {g.alertas.map((a) => (
                      <FilaAlerta key={a.id} alerta={a} nombreAlmacen={nombreAlmacen} onAbrir={() => setAbierta(a.id)} recienAtendida={atendidas.has(a.id)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      <PanelAlerta id={abierta} onCerrar={() => setAbierta(null)} onAtendida={(id) => setAtendidas(new Set([...atendidas, id]))} />
    </div>
  )
}
