import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LineaTiempoFiestas } from './LineaTiempoFiestas'

const fiestas = [
  { id: 1, nombre: 'Carnaval', fechaInicio: '2027-02-06', fechaFin: '2027-02-09', ventanaDesde: '2026-12-26', estado: 'PASADA' as const },
  { id: 7, nombre: 'Aniversario de La Paz', fechaInicio: '2027-07-16', fechaFin: '2027-08-06', ventanaDesde: '2027-06-18', estado: 'CRITICO' as const },
]

describe('Línea de tiempo de fiestas', () => {
  it('ubica la fiesta, su ventana de preparación y el marcador de la fecha simulada', () => {
    render(<LineaTiempoFiestas fiestas={fiestas} fecha="2027-06-30" onElegir={() => {}} />)
    const fila = screen.getByRole('button', { name: /Aniversario de La Paz: 16\/07\/2027 a 06\/08\/2027, Crítica/ })
    const fiesta = fila.querySelector('[data-tramo="fiesta"]') as HTMLElement
    const ventana = fila.querySelector('[data-tramo="ventana"]') as HTMLElement
    // Rango 01/01/2027–31/01/2028 = 396 días: el 16/07 es el día 196 → 49.5 %.
    expect(parseFloat(fiesta.style.left)).toBeCloseTo((196 / 396) * 100, 1)
    expect(fiesta).toHaveClass('bg-rojo')
    expect(parseFloat(ventana.style.left)).toBeLessThan(parseFloat(fiesta.style.left))
    expect(Number(screen.getByTestId('marcador-fecha').dataset.pos)).toBeCloseTo((180 / 396) * 100, 1)
    // Una ventana que empieza antes del rango se recorta al borde.
    expect(screen.getByRole('button', { name: /Carnaval/ }).querySelector('[data-tramo="ventana"]')).toHaveStyle({ left: '0%' })
  })

  it('al elegir una fiesta avisa su id y la marca como seleccionada', async () => {
    const onElegir = vi.fn()
    render(<LineaTiempoFiestas fiestas={fiestas} fecha="2027-06-30" seleccionada={7} onElegir={onElegir} />)
    await userEvent.click(screen.getByRole('button', { name: /Carnaval/ }))
    expect(onElegir).toHaveBeenCalledWith(1)
    expect(screen.getByRole('button', { name: /Aniversario/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
