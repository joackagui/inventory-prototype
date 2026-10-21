import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Semaforo } from './Semaforo'

describe('Semaforo accesible', () => {
  it.each([
    ['VERDE', 'Normal'],
    ['AMARILLO', 'Atención'],
    ['ROJO', 'Crítico'],
    ['AZUL', 'Informativo'],
  ] as const)('%s muestra ícono y texto "%s", no solo color', (color, texto) => {
    const { container } = render(<Semaforo color={color} />)
    expect(screen.getByText(texto)).toBeVisible()
    const icono = container.querySelector('svg')
    expect(icono).toHaveAttribute('aria-hidden')
  })

  it('en modo compacto el texto queda para lectores de pantalla y en el title', () => {
    render(<Semaforo color="ROJO" compacto />)
    const texto = screen.getByText('Crítico')
    expect(texto).toHaveClass('sr-only')
    expect(texto.parentElement).toHaveAttribute('title', 'Crítico')
  })
})
