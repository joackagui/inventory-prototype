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
  nombre?: string
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

export interface Medicion {
  etiqueta: string
  valor: number
  unidad: string
  amarillo: number | null
  rojo: number
  menorEsPeor: boolean
  nivelBajoEsAzul?: boolean
}

export interface AlertaDetalle extends Alerta {
  nombre: string
  referenciaTipo: string
  referenciaId: number | null
  datos: Record<string, unknown>
  medicion: Medicion | null
  fechaOperacion: string
  fechaColor: string
  fechaAtencion: string | null
  resultado: string | null
  comentario: string | null
  fechaResolucion: string | null
  atendidaPor: { codigo: string } | null
  historial: { id: number; tipo: 'CREADA' | 'CAMBIO_COLOR' | 'ATENDIDA' | 'ESCALADA' | 'RESUELTA'; colorAnterior: ColorAlerta | null; colorNuevo: ColorAlerta | null; nivel: number | null; detalle: string | null; fechaOperacion: string; usuario: { codigo: string } | null }[]
}

export interface ParametrosArticulo {
  demandaDiaria: number
  desviacionDemanda: number
  leadTimeDias: number
  claseAbc: 'A' | 'B' | 'C'
  nivelServicio: number
  z: number
  diasRevision: number
  stockSeguridad: number
  rop: number
  loteTraslado: number
  stockMaximo: number
  ultimoConteo?: string | null
}

export interface ResumenAlmacenArticulo {
  almacen: string
  nombre: string
  disponible: number
  vendible: number
  estado?: 'DISPONIBLE' | 'AGOTADO'
  reservado?: number
  cuarentena?: number
  enTransito?: number
  posicion?: number
  coberturaDias?: number
  vidaRestanteDias?: number | null
  trasladoPropuesto?: number
  parametros?: ParametrosArticulo
  costoFifoMasAntigua?: number | null
  costoUltimaCapa?: number | null
  funcion?: { seguridad: number; ciclo: number; transito: number; estacional: number; fiesta: { nombre: string; fechaInicio: string; factor: number; ropFiesta: number } | null }
  color?: ColorSemaforo
  alertas?: { id: number; codigo: string; color: ColorAlerta; mensaje: string; estado: string }[]
}

export interface ResumenArticulo {
  articulo: { codigo: string; descripcion: string; familia: string; unidad: string; esRetornable: boolean; precio?: number; vidaUtilDias?: number; costoFifoInicial?: number }
  fechaOperacion: string
  almacenes: ResumenAlmacenArticulo[]
}

export interface Capa {
  id: number
  lote: string
  almacen: { codigo: string; tipo: string }
  ubicacion: { codigo: string }
  fechaEntrada: string
  fechaElaboracion: string
  fechaVencimiento: string
  cantidadInicial: number
  cantidadRestante: number
  costoUnitario: number
  estado: 'DISPONIBLE' | 'CUARENTENA' | 'AGOTADA'
  vidaRestanteDias: number
  valor: number
  despachable: boolean
  proximaEnSalir: boolean
  motivoNoDespachable: string | null
}

export interface FilaKardex {
  id: number
  fechaOperacion: string
  tipo: string
  fisico: boolean
  motivo: string
  ubicacion: string
  lote: string | null
  usuario: string
  cantidad: number
  costoUnitario: number
  valor: number
  saldo: number
  saldoValor: number
}

export interface SerieStock {
  almacen: string
  stockSeguridad: number
  rop: number
  stockMaximo: number
  puntos: { fecha: string; saldo: number; bajoRop: boolean }[]
}

export interface FilaArticulo {
  codigo: string
  descripcion: string
  familia: string
  unidad?: string
  claseAbc?: 'A' | 'B' | 'C'
  precio?: number
  vidaUtilDias?: number
  esRetornable?: boolean
  vendibleTotal?: number
  coberturaMinimaDias?: number
  alertasVigentes?: number
  almacenes: { almacen: string; estado?: 'DISPONIBLE' | 'AGOTADO'; color?: ColorSemaforo; vendible?: number; coberturaDias?: number; alertas?: string[] }[]
}

export interface UmbralDetalle {
  clave: string
  nombre: string
  valor: Record<string, number | Record<string, number>>
  porDefecto: Record<string, number | Record<string, number>>
}
