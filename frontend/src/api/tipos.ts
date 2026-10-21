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
  referenciaTipo?: string
  referenciaId?: number | null
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

export interface AlertaEfecto {
  id: number
  codigo: string
  almacen: string | null
  articulo: string | null
  colorAntes: ColorAlerta | null
  colorDespues: ColorAlerta | null
  mensaje: string
}

export interface EfectoAlertas {
  creadas: AlertaEfecto[]
  resueltas: AlertaEfecto[]
  cambiadas: AlertaEfecto[]
}

export interface CapaConsumida {
  capaId: number
  lote: string
  cantidad: number
  costoUnitario: number
  valor: number
  vencimiento: string
  articulo?: string
}

// Toda escritura devuelve su efecto en alertas; las que consumen capas, también las capas y el costo.
export interface ConEfecto {
  efectoAlertas?: EfectoAlertas
  capasConsumidas?: CapaConsumida[]
  costoTotal?: number
}

export interface Cliente {
  id: number
  codigo: string
  nombre: string
}

export interface Pedido extends ConEfecto {
  id: number
  numero: string
  estado: 'PENDIENTE_REVISION' | 'CONFIRMADO' | 'DESPACHADO' | 'CANCELADO'
  fechaOperacion: string
  antiguedadDias: number
  conFaltante: boolean
  cliente: { codigo: string }
  almacen: { codigo: string }
  almacenId: number
  lineas: { id: number; cantidad: number; bonificacion: boolean; articulo: { codigo: string; descripcion: string } }[]
}

export interface Traslado extends ConEfecto {
  id: number
  numero: string
  estado: 'EMITIDA' | 'EN_TRANSITO' | 'RECIBIDA' | 'CON_DIFERENCIA'
  fechaEmision: string
  fechaDespacho: string | null
  fechaRecepcion: string | null
  origen: { codigo: string }
  destino: { codigo: string }
  lineas: { id: number; cantidadDespachada: number; cantidadRecibida: number | null; estadoRecepcion: string | null; articulo: { codigo: string } }[]
}

export interface PropuestaTraslado {
  articulo: string
  descripcion: string
  posicion: number
  rop: number
  stockMaximo: number
  trasladoPropuesto: number
  origenSugerido: string | null
  cantidadSugerida: number
  candidatos: { almacen: string; disponible: number; rop: number; excedente: number; coberturaSobreRop: number }[]
}

export interface Ajuste extends ConEfecto {
  id: number
  motivo: string
  cantidad: number
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  observacion: string | null
  comentarioResolucion: string | null
  fechaRegistro: string
  antiguedadDias: number
  registradoPorId: number
  articulo: { codigo: string; descripcion: string }
  almacen: { codigo: string; tipo: string }
  capa: { lote: string; fechaVencimiento: string; estado: string } | null
  ordenTraslado: { id: number; numero: string } | null
  conteo: { id: number; cantidadSistema: number; cantidadContada: number; porcentaje: number } | null
  registradoPor: { codigo: string }
  aprobadoPor: { codigo: string } | null
  impacto: { valor: number; capas: { lote: string; cantidad: number; costoUnitario: number }[] }
  valor?: number
  alertas?: { id: number; codigo: string; color: ColorAlerta; estado: string; mensaje: string }[]
}

export interface CapaListada extends Capa {
  articulo: { codigo: string; descripcion: string }
}

export interface Promocion extends ConEfecto {
  id: number
  nombre: string
  tipo: string
  estado: 'PROPUESTA' | 'BORRADOR' | 'ACTIVA' | 'FINALIZADA' | 'RECHAZADA'
  comentarioResolucion: string | null
  rechazadaPor: { codigo: string } | null
  fechaInicio: string
  fechaFin: string
  topeCajas: number
  cajasUsadas: number
  topeRestante: number
  vendible: number
  coberturaDias: number
  diasRestantes: number
  referenciaCorreo: string | null
  articulo: { codigo: string }
  almacen: { codigo: string } | null
  propuestaPor: { codigo: string } | null
  aprobadoPor: { codigo: string } | null
}

export interface SaldoEnvase {
  id: number
  clienteId: number
  articuloId: number
  cantidadEntregada: number
  cantidadDevuelta: number
  pendiente: number
  antiguedadDias: number
  fechaEntrega: string
  cliente: { codigo: string }
  articulo: { codigo: string }
  almacen: { codigo: string }
}

export interface StockAlmacen {
  almacen: string
  articulos: { codigo: string; descripcion: string; disponible: number; vendible?: number; estado?: string }[]
}

export interface Ubicacion {
  id: number
  codigo: string
  descripcion: string
  vendible: boolean
}

export interface FilaAbc {
  codigo: string
  descripcion: string
  precio: number
  demandaDiaria: number
  ventaDiaria: number
  porcentaje: number
  porcentajeAcumulado: number
  clase: 'A' | 'B' | 'C'
  claseActual: 'A' | 'B' | 'C'
  nivelServicio: number
  z: number
  frecuenciaConteoDias: number
}

export interface ParetoAjustes {
  total: number
  motivos: { motivo: string; ajustes: number; unidades: number; valor: number; porcentaje: number; porcentajeAcumulado: number }[]
}

export interface Rotacion {
  desde: string
  hasta: string
  umbrales: { alta: number; media: number }
  articulos: { codigo: string; descripcion: string; costoVendido90: number; valorStockPromedio: number; rotacionAnual: number | null; diasInventario: number | null; coberturaDias: number; nivel: 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_DATOS' }[]
}

export interface ConteosAnalisis {
  toleranciaPct: number
  exactitud: { porcentaje: number | null; conteos: number; sinDiferencia: number }
  conteos: { id: number; fecha: string; tipo: string; articulo: string; almacen: string; ubicacion: string; usuario: string; sistema: number; contado: number; diferencia: number; porcentaje: number; superaTolerancia: boolean }[]
}

export type EstadoHito = 'PASADO' | 'EN_CURSO' | 'PROXIMO'

export interface Hito {
  clave: string
  titulo: string
  desde: string
  hasta: string
  estado: EstadoHito
  responsables: string[]
  accion: string
}

export type EstadoFiesta = 'OK' | 'EN_RIESGO' | 'CRITICO' | 'PASADA'

export interface ArticuloFiesta {
  codigo: string
  descripcion: string
  demandaBase: number
  factor: number
  leadTimeDias: number
  stockSeguridad: number
  diasFiesta: number
  ropFiesta: number
  qFiesta: number
  maximoFiesta: number
  pronostico: number
  posicion: number
  brecha: number
  estado: 'OK' | 'EN_RIESGO' | 'CRITICO'
}

export interface Fiesta {
  id: number
  nombre: string
  fechaInicio: string
  fechaFin: string
  diasFiesta: number
  factor: number
  zonas: string[]
  semanasPreparacion: number
  diasFaltan: number
  pasada: boolean
  enVentanaPreparacion: boolean
  ventanaDesde: string
  estado: EstadoFiesta
  promocionSugerida: { tipo: string; desde: string; hasta: string }
  cronograma: Hito[]
  almacenes: { almacen: string; articulos: ArticuloFiesta[] }[]
}

export interface Costos {
  mes: string
  diasConsiderados: number
  tasas: { tasaConservacionAnual: number; costoPorTraslado: number; valorPedidoAgotamiento: number; margenAgotamiento: number; costoAgotamientoPorPedido: number }
  articulos: { codigo: string; descripcion: string; unidadesVendidas: number; adquisicion: number; stockPromedioUnidades: number; valorStockPromedio: number; conservacion: number; traslados: number; pedido: number; pedidosConFaltante: number; agotamiento: number; total: number }[]
  total: { adquisicion: number; conservacion: number; pedido: number; agotamiento: number; total: number; valorStockPromedio: number; traslados: number; pedidosConFaltante: number }
}

export interface Comprobacion {
  nombre: string
  ok: boolean
  revisados: number
  excepciones: string[]
  ms: number
}

export interface Integridad {
  ok: boolean
  capas: number
  comprobaciones: Comprobacion[]
}

export interface Escenario {
  nombre: string
  fecha: string
  descripcion: string
}

export interface EventoIntegracion {
  id: number
  tipo: string
  referencia: string
  estado: 'REINTENTO' | 'COLA_ERRORES' | 'PROCESADO'
  intentos: number
  fechaOperacion: string
}

export interface UsuarioPermisos {
  codigo: string
  nombre: string
  rol: Rol
  rolNombre: string
  almacen: string | null
  permisos: string[]
}

export interface ClaveConfiguracion {
  clave: string
  valor: unknown
  descripcion: string
}
