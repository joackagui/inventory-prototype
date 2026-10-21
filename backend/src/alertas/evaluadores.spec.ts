import {
  al01,
  al02,
  al03,
  al04,
  al05,
  al06,
  al07,
  al08,
  al09,
  al10,
  al11,
  al12,
  al13,
  al14,
  al15,
  al16,
  combinarUmbrales,
  nivelPorHorasEnRojo,
  UMBRALES_POR_DEFECTO as U,
  validarUmbral,
} from './evaluadores.js';

const color = (r: { color: string } | null) => r?.color ?? 'VERDE';

describe('umbrales de cada evaluador (justo debajo, en el límite y encima)', () => {
  it('AL01 reposición: ≤ ROP amarillo, ≤ SS rojo', () => {
    const b = { rop: 246, ss: 36, trasladoPropuesto: 0 };
    expect([247, 246, 37, 36, 0].map((posicion) => color(al01({ ...b, posicion })))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO', 'ROJO']);
    expect(al01({ ...b, posicion: 240, trasladoPropuesto: 496 })!.mensaje).toContain('Traslado propuesto: 496');
  });

  it('AL02 quiebre cuando el vendible es 0', () => {
    expect([1, 0, -5].map((vendible) => color(al02({ vendible, disponible: 40, trasladoPropuesto: 0 })))).toEqual(['VERDE', 'ROJO', 'ROJO']);
  });

  it('AL03 exceso: > Máx azul, > 2 × Máx rojo', () => {
    expect([624, 625, 1248, 1249].map((disponible) => color(al03({ disponible, maximo: 624 }, U)))).toEqual(['VERDE', 'AZUL', 'AZUL', 'ROJO']);
  });

  it('AL04 vencimiento: ≤ 30 amarillo, ≤ 15 rojo', () => {
    expect([31, 30, 16, 15, -1].map((vidaRestanteDias) => color(al04({ vidaRestanteDias, lote: 'L', cantidad: 1 }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO', 'ROJO']);
  });

  it('AL05 conteo atrasado: > frecuencia amarillo, > frecuencia + 7 rojo', () => {
    expect([180, 181, 187, 188].map((d) => color(al05({ diasDesdeConteo: d, clase: 'C' }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
    expect([30, 31, 38].map((d) => color(al05({ diasDesdeConteo: d, clase: 'A' }, U)))).toEqual(['VERDE', 'AMARILLO', 'ROJO']);
    expect(color(al05({ diasDesdeConteo: null, clase: 'B' }, U))).toBe('ROJO');
  });

  it('AL06 diferencia de conteo: > 0.5% amarillo, > 2% rojo', () => {
    expect([0.5, 0.51, 2, 2.01].map((porcentaje) => color(al06({ porcentaje, diferencia: -1, sistema: 100 }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
  });

  it('AL07, AL11 y AL12 por horas simuladas', () => {
    const horas = [24, 25, 48, 49];
    expect(horas.map((h) => color(al07({ horas: h, motivo: 'ROTURA', cantidad: -6 }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
    expect(horas.map((h) => color(al12({ horas: h, numero: 'PS', cantidad: 1 }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
    expect([2, 3, 24, 25].map((h) => color(al11({ horas: h, numero: 'PS' }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
  });

  it('AL08 traslado sin recepción: > L + 1 amarillo, > L + 2 rojo', () => {
    expect([5, 6, 7].map((d) => color(al08({ diasEnTransito: d, leadTimeDias: 4, numero: 'OT' }, U)))).toEqual(['VERDE', 'AMARILLO', 'ROJO']);
  });

  it('AL09 diferencia en recepción: hasta 1% amarillo, > 1% o dañado rojo', () => {
    const b = { despachada: 200, danado: false, numero: 'OT' };
    expect([0, 1, 2, 3].map((diferencia) => color(al09({ ...b, diferencia }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
    expect(color(al09({ ...b, diferencia: 0, danado: true }, U))).toBe('ROJO');
  });

  it('AL10 envases: > 30 días amarillo, > 60 rojo', () => {
    expect([30, 31, 60, 61].map((dias) => color(al10({ dias, pendiente: 5, cliente: 'C' }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
  });

  it('AL13 costo atípico: > 10% amarillo, > 15% rojo (en ambos sentidos)', () => {
    const c = (costoNuevo: number) => color(al13({ costoNuevo, costoAnterior: 10, lote: 'L' }, U));
    expect([11, 11.01, 11.5, 11.51, 8.4].map(c)).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO', 'ROJO']);
  });

  it('AL14 fiesta: ≤ 21 días amarillo, ≤ 7 rojo, solo si la posición no alcanza', () => {
    const b = { posicion: 20, pronostico: 117, fiesta: 'F' };
    expect([22, 21, 8, 7, 0].map((diasParaFiesta) => color(al14({ ...b, diasParaFiesta }, U)))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO', 'ROJO']);
    expect(color(al14({ ...b, posicion: 117, diasParaFiesta: 3 }, U))).toBe('VERDE');
  });

  it('AL15 promoción: cobertura < días restantes amarillo, vendible 0 rojo', () => {
    const b = { demandaDiaria: 20, diasRestantes: 12, promocion: 'P' };
    expect([240, 239, 110, 0].map((vendible) => color(al15({ ...b, vendible })))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
  });

  it('AL16 integración: reintento amarillo, cola de errores rojo', () => {
    const b = { tipo: 'T', referencia: 'R', intentos: 1 };
    expect(['PROCESADO', 'REINTENTO', 'COLA_ERRORES'].map((estado) => color(al16({ ...b, estado })))).toEqual(['VERDE', 'AMARILLO', 'ROJO']);
  });
});

describe('escalamiento y umbrales editables', () => {
  it('una roja sube a nivel 1 con > 24 h y a nivel 2 con > 48 h', () => {
    expect([0, 24, 25, 48, 49].map(nivelPorHorasEnRojo)).toEqual([0, 0, 1, 1, 2]);
  });

  it('valida que el amarillo se dispare antes que el rojo', () => {
    expect(validarUmbral('AL07', { amarilloHoras: 12 })).toBeNull();
    expect(validarUmbral('AL07', { amarilloHoras: 60 })).toContain('antes que el rojo');
    expect(validarUmbral('AL04', { amarilloDias: 10 })).toContain('antes que el rojo'); // en días que faltan, amarillo > rojo
    expect(validarUmbral('AL04', { amarilloDias: 45 })).toBeNull();
    expect(validarUmbral('AL03', { rojoMultiploMax: 1 })).not.toBeNull();
    expect(validarUmbral('AL07', { otra: 1 })).toContain('no tiene el campo');
    expect(validarUmbral('AL06', { rojoPct: -1 })).toContain('mayor o igual a 0');
    expect(validarUmbral('AL99', {})).toContain('No existe');
  });

  it('combina los umbrales guardados con los valores por defecto', () => {
    expect(combinarUmbrales({ AL04: { amarilloDias: 40 } }).AL04).toEqual({ amarilloDias: 40, rojoDias: 15 });
    expect(combinarUmbrales(null)).toEqual(U);
  });
});
