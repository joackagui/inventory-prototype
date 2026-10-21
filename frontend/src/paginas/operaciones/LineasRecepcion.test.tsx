import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { type LineaRecibida, LineasRecepcion, lineasValidas } from './LineasRecepcion'

const esperadas = [{ articulo: 'ART-10035', esperada: 120 }]

function Envoltura() {
  const [v, setV] = useState<LineaRecibida[]>([{ articulo: 'ART-10035', cantidadRecibida: '120', estado: 'CONFORME' }])
  return <LineasRecepcion esperadas={esperadas} valor={v} onCambiar={setV} />
}

describe('Recepción de traslado con diferencias', () => {
  it('sin diferencia no advierte nada', () => {
    render(<Envoltura />)
    expect(screen.queryByTestId('aviso-diferencia')).toBeNull()
  })

  it('una diferencia advierte el ajuste pendiente para R07; dañado advierte la cuarentena', async () => {
    render(<Envoltura />)
    const recibido = screen.getByLabelText('Recibido ART-10035')
    await userEvent.clear(recibido)
    await userEvent.type(recibido, '115')
    expect(screen.getByTestId('aviso-diferencia')).toHaveTextContent('Diferencia de 5: quedará un ajuste PENDIENTE')
    await userEvent.selectOptions(screen.getByLabelText('Estado ART-10035'), 'DANADO')
    expect(screen.getByRole('note')).toHaveTextContent('cuarentena (CUAR-01)')
  })

  it('valida cantidades: no más de lo despachado ni vacías', () => {
    expect(lineasValidas(esperadas, [{ articulo: 'ART-10035', cantidadRecibida: '115', estado: 'CONFORME' }])).toBe(true)
    expect(lineasValidas(esperadas, [{ articulo: 'ART-10035', cantidadRecibida: '121', estado: 'CONFORME' }])).toBe(false)
    expect(lineasValidas(esperadas, [{ articulo: 'ART-10035', cantidadRecibida: '', estado: 'CONFORME' }])).toBe(false)
  })
})
