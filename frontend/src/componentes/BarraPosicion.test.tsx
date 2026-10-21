import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarraFuncion, BarraPosicion } from './BarraPosicion'

describe('Barra bullet de posición de stock', () => {
  it('apila disponible, tránsito y reservado con marcas de SS, ROP y Máx en su lugar', () => {
    const { container } = render(<BarraPosicion disponible={920} enTransito={0} reservado={160} ss={60} rop={420} max={1260} color="VERDE" />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Disponible 920, en tránsito 0, reservado 160; SS 60, ROP 420, Máx 1,260')
    // Escala = Máx × 1.15 = 1,449: el ROP queda en 420 / 1,449 ≈ 29 %.
    const rop = container.querySelector('[data-marca="ROP"]') as HTMLElement
    expect(parseFloat(rop.style.left)).toBeCloseTo((420 / 1449) * 100, 1)
    const disponible = container.querySelector('[data-tramo="Disponible"]') as HTMLElement
    expect(parseFloat(disponible.style.width)).toBeCloseTo((920 / 1449) * 100, 1)
    expect(screen.getByText('Máx 1,260')).toBeInTheDocument()
  })

  it('un disponible negativo no dibuja barra y la escala crece si el stock supera el Máx', () => {
    const { container } = render(<BarraPosicion disponible={3000} enTransito={0} reservado={0} ss={60} rop={420} max={1260} color="AZUL" />)
    expect(parseFloat((container.querySelector('[data-tramo="Disponible"]') as HTMLElement).style.width)).toBe(100)
  })

  it('la barra de funciones muestra los cuatro tipos de stock', () => {
    render(<BarraFuncion seguridad={60} ciclo={860} transito={0} estacional={126} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Seguridad 60, Ciclo 860, Tránsito 0, Estacional (recomendado) 126')
  })
})
