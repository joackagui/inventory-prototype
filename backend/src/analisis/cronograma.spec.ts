import { cronogramaFiesta } from './cronograma.js';

const F = (s: string) => new Date(`${s}T00:00:00Z`);
// Aniversario de La Paz y Día de la Patria: 16/07 – 06/08/2027, 4 semanas de preparación.
const aniversario = { fechaInicio: F('2027-07-16'), fechaFin: F('2027-08-06'), semanasPreparacion: 4 };

describe('cronograma de preparación de fiestas', () => {
  it('ordena los hitos y calcula sus fechas objetivo', () => {
    const c = cronogramaFiesta(aniversario, F('2027-06-30'));
    expect(c.map((h) => [h.clave, h.desde, h.hasta])).toEqual([
      ['preparacion', '2027-06-18', '2027-06-18'], // coincide con «4 semanas antes»
      ['4-semanas', '2027-06-18', '2027-06-24'],
      ['3-semanas', '2027-06-25', '2027-07-01'],
      ['2-semanas', '2027-07-02', '2027-07-08'],
      ['1-semana', '2027-07-09', '2027-07-15'],
      ['durante', '2027-07-16', '2027-08-06'],
      ['1-semana-despues', '2027-08-13', '2027-08-19'],
      ['2-semanas-despues', '2027-08-20', '2027-08-26'],
    ]);
  });

  it('el estado de cada hito depende de la fecha simulada', () => {
    const estados = (fecha: string) => Object.fromEntries(cronogramaFiesta(aniversario, F(fecha)).map((h) => [h.clave, h.estado]));
    expect(estados('2027-06-30')).toMatchObject({ preparacion: 'PASADO', '4-semanas': 'PASADO', '3-semanas': 'EN_CURSO', '2-semanas': 'PROXIMO', durante: 'PROXIMO' });
    expect(estados('2027-07-09')).toMatchObject({ '2-semanas': 'PASADO', '1-semana': 'EN_CURSO', durante: 'PROXIMO' });
    expect(estados('2027-07-20')).toMatchObject({ '1-semana': 'PASADO', durante: 'EN_CURSO', '1-semana-despues': 'PROXIMO' });
  });

  it('con 8 semanas de preparación (Navidad) la preparación dura hasta 4 semanas antes', () => {
    const c = cronogramaFiesta({ fechaInicio: F('2027-12-24'), fechaFin: F('2027-12-25'), semanasPreparacion: 8 }, F('2027-10-30'));
    expect(c[0]).toMatchObject({ clave: 'preparacion', desde: '2027-10-29', hasta: '2027-11-25', estado: 'EN_CURSO', responsables: ['R07'] });
  });
});
