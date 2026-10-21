import { describe, expect, it } from 'vitest'
import { antiguedad, compacto, dinero, fecha, fechaCorta, numero, porcentaje } from './formato'

describe('formateadores regionales', () => {
  it('números con separador de miles y cifras fijas', () => {
    expect(numero(1260)).toBe('1,260')
    expect(numero(7.06, 1)).toBe('7.1')
    expect(numero(-6)).toBe('-6')
    expect(numero(null)).toBe('—')
  })

  it('dinero en USD con dos decimales', () => {
    expect(dinero(16554)).toBe('USD 16,554.00')
    expect(dinero(78535.656)).toBe('USD 78,535.66')
    expect(dinero(undefined)).toBe('—')
  })

  it('fechas dd/mm/aaaa sin corrimiento por zona horaria', () => {
    expect(fecha('2027-06-30')).toBe('30/06/2027')
    expect(fecha('2027-07-01T00:00:00.000Z')).toBe('01/07/2027')
    expect(fechaCorta('2027-06-30')).toBe('30/06')
    expect(fecha(null)).toBe('—')
  })

  it('porcentaje, compacto y antigüedad', () => {
    expect(porcentaje(93.33)).toBe('93.3%')
    expect(compacto(16500)).toBe('16.5K')
    expect([0, 1, 12].map(antiguedad)).toEqual(['hoy', 'hace 1 día', 'hace 12 días'])
  })
})
