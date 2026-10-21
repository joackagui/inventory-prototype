// Fórmulas de inventario (sección 5 y 9 de docs/ESPECIFICACION.md). Funciones puras, sin base de datos.

export type ClaseAbc = 'A' | 'B' | 'C';

export const NIVEL_SERVICIO: Record<ClaseAbc, { nivelServicio: number; z: number }> = {
  A: { nivelServicio: 0.98, z: 2.05 },
  B: { nivelServicio: 0.95, z: 1.65 },
  C: { nivelServicio: 0.9, z: 1.28 },
};

const DIAS_REVISION: Record<ClaseAbc, number> = { A: 7, B: 7, C: 14 };

const MS_DIA = 86_400_000;

// Criterio único de redondeo para SS: Math.round.
const calcularSS = (z: number, sigma: number, leadTimeDias: number): number =>
  Math.round(z * sigma * Math.sqrt(leadTimeDias));

const calcularROP = (d: number, leadTimeDias: number, ss: number): number => d * leadTimeDias + ss;

const calcularQ = (d: number, diasRevision: number): number => d * diasRevision;

const calcularMaximo = (rop: number, q: number): number => rop + q;

export const calcularPosicion = (disponible: number, transito: number): number => disponible + transito;

// Solo se propone traslado cuando la posición llega al ROP.
export const trasladoPropuesto = (maximo: number, posicion: number, rop: number): number =>
  posicion <= rop ? maximo - posicion : 0;

// Días de cobertura con un decimal.
export const cobertura = (disponible: number, d: number): number =>
  d > 0 ? Math.round((disponible / d) * 10) / 10 : 0;

export interface EntradaAbc {
  codigo: string;
  precio: number;
  demandaDiaria: number;
}

export interface ResultadoAbc extends EntradaAbc {
  ventaDiaria: number;
  porcentaje: number;
  porcentajeAcumulado: number;
  clase: ClaseAbc;
}

// Pareto por venta diaria en dólares (precio × d): A hasta 80% acumulado, B hasta 95%, C el resto.
export function clasificarAbc(articulos: EntradaAbc[]): ResultadoAbc[] {
  const conVenta = articulos
    .map((a) => ({ ...a, ventaDiaria: Math.round(a.precio * a.demandaDiaria * 100) / 100 }))
    .sort((a, b) => b.ventaDiaria - a.ventaDiaria);
  const total = conVenta.reduce((s, a) => s + a.ventaDiaria, 0);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  let acumulado = 0;
  return conVenta.map((a, i) => {
    acumulado += a.ventaDiaria;
    const porcentaje = total ? r2((a.ventaDiaria / total) * 100) : 0;
    const porcentajeAcumulado = total ? r2((acumulado / total) * 100) : 0;
    // El primer artículo siempre es A, aunque él solo supere el 80%.
    const clase: ClaseAbc = i === 0 || porcentajeAcumulado <= 80 ? 'A' : porcentajeAcumulado <= 95 ? 'B' : 'C';
    return { ...a, porcentaje, porcentajeAcumulado, clase };
  });
}

export const ropFiesta = (d: number, f: number, leadTimeDias: number, ss: number): number =>
  Math.round(d * f * leadTimeDias + ss * f);

export const qFiesta = (d: number, f: number, diasRevision = 7): number => Math.round(d * f * diasRevision);

export const pronosticoFiesta = (d: number, f: number, diasFiesta: number): number => Math.round(d * f * diasFiesta);

// Costo de conservación mensual = valor del stock promedio × tasa anual ÷ 12.
export const costoConservacion = (valorStockPromedio: number, tasaAnual: number): number =>
  Math.round(((valorStockPromedio * tasaAnual) / 12) * 100) / 100;

export const vidaRestanteDias = (fechaVencimiento: Date, fechaOperacion: Date): number =>
  Math.round((fechaVencimiento.getTime() - fechaOperacion.getTime()) / MS_DIA);

export interface ParametrosCalculados {
  nivelServicio: number;
  z: number;
  diasRevision: number;
  stockSeguridad: number;
  rop: number;
  loteTraslado: number;
  stockMaximo: number;
}

// Z para un nivel de servicio. Los tres niveles de la especificación usan su Z tabulado (2.05, 1.65, 1.28);
// cualquier otro se calcula con la inversa de la normal (aproximación de Acklam) a 2 decimales.
export function zDesdeNivelServicio(nivelServicio: number): number {
  const tabulado = Object.values(NIVEL_SERVICIO).find((n) => Math.abs(n.nivelServicio - nivelServicio) < 1e-9);
  if (tabulado) return tabulado.z;
  if (!(nivelServicio > 0 && nivelServicio < 1)) throw new RangeError('El nivel de servicio debe estar entre 0 y 1');
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const p = nivelServicio;
  let z: number;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - 0.02425) {
    const q = p - 0.5;
    const r = q * q;
    z = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return Math.round(z * 100) / 100;
}

// Único camino para obtener SS, ROP, Q y Máx a partir de las entradas.
export function calcularParametros(
  d: number,
  sigma: number,
  leadTimeDias: number,
  clase: ClaseAbc,
  nivelServicio = NIVEL_SERVICIO[clase].nivelServicio,
): ParametrosCalculados {
  const z = zDesdeNivelServicio(nivelServicio);
  const diasRevision = DIAS_REVISION[clase];
  const stockSeguridad = calcularSS(z, sigma, leadTimeDias);
  const rop = calcularROP(d, leadTimeDias, stockSeguridad);
  const loteTraslado = calcularQ(d, diasRevision);
  return { nivelServicio, z, diasRevision, stockSeguridad, rop, loteTraslado, stockMaximo: calcularMaximo(rop, loteTraslado) };
}

// Tipos de movimiento con cantidades físicas (los demás son de control: RESERVA, LIBERACION_RESERVA, CONTEO, ENVASE_*).
// CUARENTENA mueve stock entre ubicaciones del mismo almacén con dos patas (−n y +n): suma 0 en el almacén.
export const TIPOS_FISICOS = [
  'ENTRADA',
  'CUARENTENA',
  'SALIDA',
  'TRASLADO_SALIDA',
  'TRASLADO_ENTRADA',
  'AJUSTE',
  'MERMA',
  'BONIFICACION',
] as const;
