import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccionesResolucion, motivoNoAprobar } from './AccionesResolucion'

describe('Bandeja de aprobaciones: decidir un pendiente', () => {
  it('solo R07 decide, nunca sobre lo que registró; R08 es solo lectura', () => {
    expect(motivoNoAprobar('R07', 6, 4)).toBeNull()
    expect(motivoNoAprobar('R07', 6, 6)).toBe('Quien registra no aprueba: otro coordinador debe decidirlo.')
    expect(motivoNoAprobar('R06', 4, 2)).toContain('Solo el coordinador')
    expect(motivoNoAprobar('R08', 7, 2)).toContain('Solo lectura')
  })

  it('rechazar exige comentario; aprobar no', async () => {
    const onAprobar = vi.fn()
    const onRechazar = vi.fn()
    render(<AccionesResolucion bloqueo={null} cargando={false} onAprobar={onAprobar} onRechazar={onRechazar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(onRechazar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe por qué se rechaza.')
    await userEvent.type(screen.getByLabelText('Comentario'), 'El recuento cuadra')
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(onRechazar).toHaveBeenCalledWith('El recuento cuadra')
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(onAprobar).toHaveBeenCalledWith('El recuento cuadra', '')
  })

  it('bloqueado: botones deshabilitados con la explicación; promociones piden la referencia del correo', async () => {
    const { rerender } = render(<AccionesResolucion bloqueo="Quien registra no aprueba: otro coordinador debe decidirlo." cargando={false} onAprobar={vi.fn()} onRechazar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('Quien registra no aprueba')
    const onAprobar = vi.fn()
    rerender(<AccionesResolucion bloqueo={null} cargando={false} onAprobar={onAprobar} onRechazar={vi.fn()} pideReferencia />)
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Referencia del correo'), 'CORREO-GLV-1')
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(onAprobar).toHaveBeenCalledWith('', 'CORREO-GLV-1')
  })
})
