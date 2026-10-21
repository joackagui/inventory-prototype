import {
  calcularParametros,
  calcularPosicion,
  clasificarAbc,
  cobertura,
  costoConservacion,
  pronosticoFiesta,
  qFiesta,
  ropFiesta,
  trasladoPropuesto,
  vidaRestanteDias,
  zDesdeNivelServicio,
} from './formulas.js';

// Datos de La Paz (sección 4 de la especificación).
const ARTICULOS = [
  { codigo: 'ART-10021', precio: 18.7, demandaDiaria: 120, sigma: 17 },
  { codigo: 'ART-10022', precio: 21.9, demandaDiaria: 70, sigma: 10 },
  { codigo: 'ART-10035', precio: 21.4, demandaDiaria: 45, sigma: 6.5 },
  { codigo: 'ART-10048', precio: 18.2, demandaDiaria: 35, sigma: 5 },
  { codigo: 'ART-20011', precio: 7.8, demandaDiaria: 60, sigma: 8.5 },
  { codigo: 'ART-10063', precio: 19.3, demandaDiaria: 20, sigma: 3 },
  { codigo: 'ART-30005', precio: 4.6, demandaDiaria: 25, sigma: 4 },
];
const CLASE = { 'ART-10021': 'A', 'ART-10022': 'A', 'ART-10035': 'A', 'ART-10048': 'B', 'ART-20011': 'B', 'ART-10063': 'C', 'ART-30005': 'C' } as const;

describe('parámetros de reposición', () => {
  it('ART-10021 en los 3 almacenes', () => {
    expect(calcularParametros(120, 17, 3, 'A')).toMatchObject({ stockSeguridad: 60, rop: 420, loteTraslado: 840, stockMaximo: 1260 });
    // Cochabamba: d = round(0.67 × 120) = 80, σ = 0.86 × 17, L = 4.
    expect(calcularParametros(Math.round(0.67 * 120), 0.86 * 17, 4, 'A')).toMatchObject({ rop: 380, loteTraslado: 560, stockMaximo: 940 });
    // Santa Cruz: d = round(1.08 × 120) = 130, σ igual, L = 3.
    expect(calcularParametros(Math.round(1.08 * 120), 17, 3, 'A')).toMatchObject({ rop: 450, loteTraslado: 910, stockMaximo: 1360 });
  });

  it('SS, ROP y Máx de los 7 artículos en La Paz', () => {
    const r = ARTICULOS.map((a) => calcularParametros(a.demandaDiaria, a.sigma, 3, CLASE[a.codigo as keyof typeof CLASE]));
    expect(r.map((p) => p.stockSeguridad)).toEqual([60, 36, 23, 14, 24, 7, 9]);
    expect(r.map((p) => p.rop)).toEqual([420, 246, 158, 119, 204, 67, 84]);
    expect(r.map((p) => p.stockMaximo)).toEqual([1260, 736, 473, 364, 624, 347, 434]);
  });

  it('traslado propuesto de ART-10022 en La Paz es 496', () => {
    const p = calcularParametros(70, 10, 3, 'A');
    expect(trasladoPropuesto(p.stockMaximo, calcularPosicion(240, 0), p.rop)).toBe(496);
    // Por encima del ROP no se propone traslado.
    expect(trasladoPropuesto(p.stockMaximo, 300, p.rop)).toBe(0);
  });

  it('Z tabulado para 98/95/90% y calculado para otros niveles', () => {
    expect([0.98, 0.95, 0.9].map(zDesdeNivelServicio)).toEqual([2.05, 1.65, 1.28]);
    expect(zDesdeNivelServicio(0.99)).toBe(2.33);
    expect(zDesdeNivelServicio(0.5)).toBe(0);
    expect(calcularParametros(120, 17, 3, 'A', 0.99)).toMatchObject({ z: 2.33, stockSeguridad: 69 });
  });

  it('cobertura en días', () => {
    expect(cobertura(920, 120)).toBe(7.7);
    expect(cobertura(10, 0)).toBe(0);
  });
});

describe('clasificación ABC', () => {
  it('reproduce A/B/C de la especificación', () => {
    const r = clasificarAbc(ARTICULOS);
    const por = (c: string) => r.filter((a) => a.clase === c).map((a) => a.codigo).sort();
    expect(por('A')).toEqual(['ART-10021', 'ART-10022', 'ART-10035']);
    expect(por('B')).toEqual(['ART-10048', 'ART-20011']);
    expect(por('C')).toEqual(['ART-10063', 'ART-30005']);
    expect(r.at(-1)!.porcentajeAcumulado).toBeCloseTo(100);
  });

  it('un único artículo dominante sigue siendo A', () => {
    expect(clasificarAbc([{ codigo: 'X', precio: 1, demandaDiaria: 99 }, { codigo: 'Y', precio: 1, demandaDiaria: 1 }])[0].clase).toBe('A');
  });
});

describe('fiestas, costos y vencimiento', () => {
  it('Navidad para ART-10021 en La Paz: ROP 714, Q 1428, Máx 2142', () => {
    const rop = ropFiesta(120, 1.7, 3, 60);
    const q = qFiesta(120, 1.7);
    expect([rop, q, rop + q]).toEqual([714, 1428, 2142]);
    expect(pronosticoFiesta(120, 1.7, 2)).toBe(408);
  });

  it('conservación mensual de ART-10021 en junio ≈ USD 207', () => {
    expect(Math.round(costoConservacion(1335 * 12.4, 0.15))).toBe(207);
  });

  it('vida restante en días', () => {
    expect(vidaRestanteDias(new Date('2027-11-14T00:00:00Z'), new Date('2027-06-30T00:00:00Z'))).toBe(137);
  });
});
