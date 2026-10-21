import { compararAlertas } from './efecto.js';

const foto = (filas: [string, string][]) => new Map(filas.map(([clave, color], i) => [clave, { id: i, codigo: clave.slice(0, 4), almacen: 'CD-LP-01', articulo: null, color, mensaje: clave }]));

describe('efecto en alertas', () => {
  it('separa creadas, resueltas y cambios de color', () => {
    const r = compararAlertas(foto([['AL01|a', 'AMARILLO'], ['AL04|b', 'ROJO'], ['AL05|c', 'AMARILLO']]), foto([['AL01|a', 'ROJO'], ['AL05|c', 'AMARILLO'], ['AL13|d', 'AMARILLO']]));
    expect(r.creadas.map((a) => [a.codigo, a.colorAntes, a.colorDespues])).toEqual([['AL13', null, 'AMARILLO']]);
    expect(r.resueltas.map((a) => [a.codigo, a.colorAntes, a.colorDespues])).toEqual([['AL04', 'ROJO', null]]);
    expect(r.cambiadas.map((a) => [a.codigo, a.colorAntes, a.colorDespues])).toEqual([['AL01', 'AMARILLO', 'ROJO']]);
  });
});
