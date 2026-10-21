import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ControlFecha } from './ControlFecha'

const props = () => ({ fecha: '2027-07-05', puedeCambiar: true, onMover: vi.fn(), onFijar: vi.fn(), onRestablecer: vi.fn() })

describe('ControlFecha (reloj simulado)', () => {
  it('muestra la fecha en formato dd/mm/aaaa', () => {
    render(<ControlFecha {...props()} />)
    expect(screen.getByTestId('fecha-simulada')).toHaveTextContent('05/07/2027')
  })

  it('los botones mueven la fecha −1, +1, +7 y +30 días', async () => {
    const p = props()
    render(<ControlFecha {...p} />)
    for (const [etiqueta, dias] of [['Retroceder 1 día', -1], ['Avanzar 1 día', 1], ['Avanzar 7 días', 7], ['Avanzar 30 días', 30]] as const) {
      await userEvent.click(screen.getByRole('button', { name: etiqueta }))
      expect(p.onMover).toHaveBeenLastCalledWith(dias)
    }
  })

  it('el selector fija una fecha exacta y restablecer vuelve al 30/06/2027', async () => {
    const p = props()
    render(<ControlFecha {...p} />)
    fireEvent.change(screen.getByLabelText('Elegir fecha simulada'), { target: { value: '2027-07-15' } })
    expect(p.onFijar).toHaveBeenCalledWith('2027-07-15')
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer al 30/06/2027' }))
    expect(p.onRestablecer).toHaveBeenCalled()
  })

  it('sin permiso solo se ve la fecha; ocupado desactiva los botones', () => {
    const { rerender } = render(<ControlFecha {...props()} puedeCambiar={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<ControlFecha {...props()} ocupado />)
    expect(screen.getByRole('button', { name: 'Avanzar 1 día' })).toBeDisabled()
  })
})
