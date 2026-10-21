export type Rol = 'R01' | 'R02' | 'R03' | 'R06' | 'R07' | 'R08' | 'R09'
export type ColorSemaforo = 'VERDE' | 'AMARILLO' | 'ROJO' | 'AZUL'
export type ColorAlerta = Exclude<ColorSemaforo, 'VERDE'>

export interface Usuario {
  id: number
  codigo: string
  nombre: string
  rolCodigo: Rol
  rol: { codigo: Rol; nombre: string }
  almacen: { id: number; codigo: string } | null
}

export interface FilaSemaforo {
  codigo: string
  descripcion: string
  claseAbc: 'A' | 'B' | 'C'
  disponible: number
  vendible: number
  reservado: number
  enTransito: number
  posicion: number
  coberturaDias: number
  rop: number
  stockSeguridad: number
  stockMaximo: number
  vidaRestanteDias: number | null
  trasladoPropuesto: number
  color: ColorSemaforo
  alertas: string[]
}

export interface Semaforo {
  almacen: string
  fechaOperacion: string
  articulos: FilaSemaforo[]
}

export interface ResumenTablero {
  almacen: string | null
  fechaOperacion: string
  valorInventario: number
  valorCuarentena: number
  articulos: { total: number; enQuiebre: number; bajoRop: number; normales: number; enExceso: number; venceEn30Dias: number }
  alertas: { total: number; porColor: Record<ColorAlerta, number>; sinAtender: number; rojasSinAtender: number; escaladas: number }
  coberturaMediaDias: number
  trasladosEnTransito: { ordenes: number; unidades: number }
  ajustesPendientes: number
  pedidosPendientesRevision: number
  exactitudInventario: { porcentaje: number | null; conteos: number; sinDiferencia: number; desde: string }
  ventasDiarias: { fecha: string; unidades: number; usd: number }[]
  valorPorAlmacen: { almacen: string; nombre: string; valor: number }[]
}

export interface Alerta {
  id: number
  codigo: string
  color: ColorAlerta
  estado: 'ABIERTA' | 'ATENDIDA' | 'RESUELTA'
  situacion: string
  mensaje: string
  accionSugerida: string
  rolesResponsables: string[]
  nivelEscalamiento: number
  antiguedadDias: number
  almacen: { codigo: string } | null
  articulo: { codigo: string } | null
}

export interface Pagina<T> {
  total: number
  pagina: number
  tamano: number
  datos: T[]
}

export interface ResumenAlertas {
  total: number
  porColor: Record<ColorAlerta, number>
  sinAtender: number
  rojasSinAtender: number
  escaladas: number
}

export interface StockPreventista {
  almacen: string
  articulos: { codigo: string; descripcion: string; disponible: number; estado: 'DISPONIBLE' | 'AGOTADO' }[]
}

export interface CambioFecha {
  fechaSimulada: string
  fechaAnterior: string | null
  alertas: { creadas: number; cambiosColor: number; resueltas: number; escaladas: number; abiertas: number } | null
}
