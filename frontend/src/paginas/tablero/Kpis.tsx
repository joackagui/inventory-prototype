import { CalendarClock, ClipboardCheck, Gauge, PackagePlus, PackageX, Target, TrendingDown, Truck, Wallet } from 'lucide-react'
import type { ResumenTablero } from '../../api/tipos'
import { Kpi } from '../../componentes/Kpi'
import { Esqueleto } from '../../componentes/Tarjeta'
import { dinero, numero, porcentaje } from '../../utils/formato'

export function Kpis({ datos }: { datos?: ResumenTablero }) {
  if (!datos) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 9 }, (_, i) => (
          <Esqueleto key={i} className={`h-28 ${i === 0 ? '2xl:col-span-2' : ''}`} />
        ))}
      </div>
    )
  }
  const { articulos: a, exactitudInventario: e } = datos
  const tarjetas = [
    { titulo: 'Valor del inventario', valor: dinero(datos.valorInventario), contexto: `${numero(a.total)} artículo-almacén · cuarentena ${dinero(datos.valorCuarentena)}`, icono: Wallet, className: 'sm:col-span-2 lg:col-span-1 2xl:col-span-2' },
    { titulo: 'En quiebre', valor: numero(a.enQuiebre), contexto: 'sin stock vendible', icono: PackageX, tono: a.enQuiebre ? 'ROJO' : 'VERDE' },
    { titulo: 'Bajo ROP', valor: numero(a.bajoRop), contexto: 'posición ≤ punto de reorden', icono: TrendingDown, tono: a.bajoRop ? 'AMARILLO' : 'VERDE' },
    { titulo: 'Con exceso', valor: numero(a.enExceso), contexto: 'disponible > máximo', icono: PackagePlus, tono: a.enExceso ? 'AZUL' : 'VERDE' },
    { titulo: 'Próximos a vencer', valor: numero(a.venceEn30Dias), contexto: 'con una capa ≤ 30 días', icono: CalendarClock, tono: a.venceEn30Dias ? 'AMARILLO' : 'VERDE' },
    { titulo: 'Cobertura media', valor: `${numero(datos.coberturaMediaDias, 1)} días`, contexto: 'ponderada por demanda diaria', icono: Gauge },
    { titulo: 'Traslados en tránsito', valor: numero(datos.trasladosEnTransito.ordenes), contexto: `${numero(datos.trasladosEnTransito.unidades)} unidades en camino`, icono: Truck },
    { titulo: 'Ajustes pendientes', valor: numero(datos.ajustesPendientes), contexto: 'esperan aprobación de R07', icono: ClipboardCheck, tono: datos.ajustesPendientes ? 'AMARILLO' : 'VERDE' },
    { titulo: 'Exactitud del inventario', valor: porcentaje(e.porcentaje), contexto: `${numero(e.sinDiferencia)} de ${numero(e.conteos)} conteos sin diferencia (90 días)`, icono: Target },
  ] as const
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {tarjetas.map((t, i) => (
        <Kpi key={t.titulo} {...t} retraso={i * 30} />
      ))}
    </div>
  )
}
