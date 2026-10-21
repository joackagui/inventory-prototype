import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogoRestablecer } from './DialogoRestablecer'

describe('Diálogo de restablecer datos', () => {
  it('solo se confirma escribiendo exactamente RESTABLECER', async () => {
    const onConfirmar = vi.fn()
    render(<DialogoRestablecer abierto onCerrar={() => {}} onConfirmar={onConfirmar} cargando={false} />)
    const boton = screen.getByRole('button', { name: 'Restablecer datos' })
    expect(boton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Confirmación'), 'restablecer')
    expect(boton).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Confirmación'))
    await userEvent.type(screen.getByLabelText('Confirmación'), 'RESTABLECER')
    await userEvent.click(boton)
    expect(onConfirmar).toHaveBeenCalledOnce()
  })

  it('mientras restablece muestra el progreso y no permite cancelar', () => {
    render(<DialogoRestablecer abierto onCerrar={() => {}} onConfirmar={() => {}} cargando />)
    expect(screen.getByRole('status')).toHaveTextContent('Restableciendo')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})
