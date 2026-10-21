// Fórmulas de inventario (sección 5 y 9 de docs/ESPECIFICACION.md). Funciones puras, sin base de datos.

export type ClaseAbc = 'A' | 'B' | 'C';

export const NIVEL_SERVICIO: Record<ClaseAbc, { nivelServicio: number; z: number }> = {
  A: { nivelServicio: 0.98, z: 2.05 },
  B: { nivelServicio: 0.95, z: 1.65 },
  C: { nivelServicio: 0.9, z: 1.28 },
};

export const DIAS_REVISION: Record<ClaseAbc, number> = { A: 7, B: 7, C: 14 };

const MS_DIA = 86_400_000;

// Criterio único de redondeo para SS: Math.round.
export const calcularSS = (z: number, sigma: number, leadTimeDias: number): number =>
  Math.round(z * sigma * Math.sqrt(leadTimeDias));

export const calcularROP = (d: number, leadTimeDias: number, ss: number): number => d * leadTimeDias + ss;

export const calcularQ = (d: number, diasRevision: number): number => d * diasRevision;

export const calcularMaximo = (rop: number, q: number): number => rop + q;

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

// Único camino para obtener SS, ROP, Q y Máx a partir de las entradas.
export function calcularParametros(d: number, sigma: number, leadTimeDias: number, clase: ClaseAbc): ParametrosCalculados {
  const { nivelServicio, z } = NIVEL_SERVICIO[clase];
  const diasRevision = DIAS_REVISION[clase];
  const stockSeguridad = calcularSS(z, sigma, leadTimeDias);
  const rop = calcularROP(d, leadTimeDias, stockSeguridad);
  const loteTraslado = calcularQ(d, diasRevision);
  return { nivelServicio, z, diasRevision, stockSeguridad, rop, loteTraslado, stockMaximo: calcularMaximo(rop, loteTraslado) };
}

// Tipos de movimiento que cambian el stock físico del almacén (los demás son de control).
export const TIPOS_FISICOS = [
  'ENTRADA',
  'SALIDA',
  'TRASLADO_SALIDA',
  'TRASLADO_ENTRADA',
  'AJUSTE',
  'MERMA',
  'BONIFICACION',
] as const;
