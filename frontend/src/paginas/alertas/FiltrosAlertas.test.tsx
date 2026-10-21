import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { aParametros, FILTROS_INICIALES, FiltrosAlertas } from './FiltrosAlertas'

describe('Filtros del Centro de alertas', () => {
  it('traduce los filtros a parámetros de la API (familia → lista de códigos, almacén global)', () => {
    expect(aParametros(FILTROS_INICIALES, 'TODOS')).toBe('tamano=500&orden=gravedad&estado=VIGENTE')
    expect(new URLSearchParams(aParametros({ ...FILTROS_INICIALES, familia: 'CONTEO', color: 'ROJO', rol: 'R06' }, 'CD-LP-01')).toString()).toBe(
      'tamano=500&orden=gravedad&estado=VIGENTE&color=ROJO&codigos=AL05%2CAL06%2CAL07&rol=R06&almacen=CD-LP-01',
    )
    expect(aParametros({ ...FILTROS_INICIALES, rapido: 'sinAtender' }, 'TODOS')).toBe('tamano=500&orden=gravedad&sinAtender=true')
  })

  it('elegir tipo, color o estado avisa con el filtro nuevo', async () => {
    const onCambiar = vi.fn()
    render(<FiltrosAlertas valor={FILTROS_INICIALES} onCambiar={onCambiar} roles={[{ codigo: 'R06', nombre: 'Almacén' }]} />)
    await userEvent.selectOptions(screen.getByLabelText('Tipo de alerta'), 'VENCIMIENTO')
    expect(onCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ familia: 'VENCIMIENTO' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crítico' }))
    expect(onCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ color: 'ROJO' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Resueltas' }))
    expect(onCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'RESUELTA', rapido: '' }))
  })
})
