import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Medidor, zonaDe } from './Medidor'

const al01 = { etiqueta: 'Posición', valor: 240, unidad: 'u.', amarillo: 246, rojo: 36, menorEsPeor: true }

describe('Medidor de valor contra umbral', () => {
  it('ubica la zona con la misma regla del backend (≤ cuando menor es peor, > en el resto)', () => {
    expect(zonaDe(al01)).toBe('AMARILLO')
    expect(zonaDe({ ...al01, valor: 36 })).toBe('ROJO')
    expect(zonaDe({ ...al01, valor: 247 })).toBe('VERDE')
    const al05 = { etiqueta: 'Días', valor: 185, unidad: 'días', amarillo: 180, rojo: 187, menorEsPeor: false }
    expect([180, 181, 187, 188].map((valor) => zonaDe({ ...al05, valor }))).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO'])
    expect(zonaDe({ etiqueta: 'D', valor: 700, unidad: 'u.', amarillo: 624, rojo: 1248, menorEsPeor: false, nivelBajoEsAzul: true })).toBe('AZUL')
  })

  it('describe valor y umbrales en texto accesible', () => {
    render(<Medidor medicion={al01} />)
    const figura = screen.getByRole('img')
    expect(figura).toHaveAccessibleName('Posición: 240 u., en zona amarilla. Amarillo ≤ 246, rojo ≤ 36.')
    expect(screen.getByText('rojo 36')).toBeInTheDocument()
    expect(screen.getByText('amarillo 246')).toBeInTheDocument()
  })
})
