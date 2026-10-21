import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ResultadoOperacion } from './ResultadoOperacion'

const efecto = {
  creadas: [{ id: 1, codigo: 'AL01', almacen: 'CD-LP-01', articulo: 'ART-10021', colorAntes: null, colorDespues: 'AMARILLO' as const, mensaje: 'Posición 320 ≤ ROP 420.' }],
  resueltas: [{ id: 2, codigo: 'AL04', almacen: 'CD-LP-01', articulo: 'ART-10063', colorAntes: 'ROJO' as const, colorDespues: null, mensaje: 'Lote vence' }],
  cambiadas: [{ id: 3, codigo: 'AL05', almacen: 'CD-LP-01', articulo: 'ART-30005', colorAntes: 'AMARILLO' as const, colorDespues: 'ROJO' as const, mensaje: 'Conteo' }],
}

describe('Panel de resultado de una operación', () => {
  it('muestra capas consumidas en orden, su valor y el costo total', () => {
    render(
      <MemoryRouter>
        <ResultadoOperacion
          titulo="Pedido despachado"
          detalles={[['Pedido', 'PS-0006']]}
          capas={[
            { capaId: 1, lote: 'LP-10021-270518', cantidad: 360, costoUnitario: 12.4, valor: 4464, vencimiento: '2027-11-14' },
            { capaId: 2, lote: 'LP-10021-270528', cantidad: 240, costoUnitario: 12.52, valor: 3004.8, vencimiento: '2027-11-24' },
          ]}
          costoTotal={7468.8}
        />
      </MemoryRouter>,
    )
    const capas = within(screen.getByTestId('capas-consumidas')).getAllByRole('listitem')
    expect(capas[0]).toHaveTextContent('LP-10021-270518360 × 12.40 = USD 4,464.00vence 14/11/2027')
    expect(capas[1]).toHaveTextContent('240 × 12.52 = USD 3,004.80')
    expect(screen.getByTestId('costo-total')).toHaveTextContent('USD 7,468.80')
  })

  it('lista el efecto en alertas: creadas, resueltas y cambios de color', () => {
    render(
      <MemoryRouter>
        <ResultadoOperacion titulo="Listo" detalles={[]} efecto={efecto} />
      </MemoryRouter>,
    )
    const lista = screen.getByTestId('efecto-alertas')
    expect(lista.querySelector('[data-efecto="creada"]')).toHaveTextContent('AL01 creada')
    expect(lista.querySelector('[data-efecto="resuelta"]')).toHaveTextContent('AL04 resuelta')
    expect(lista.querySelector('[data-efecto="cambiada"]')).toHaveTextContent('AL05 Atención → Crítico')
    expect(screen.getByText('Efecto en alertas (3)')).toBeInTheDocument()
  })

  it('sin cambios lo dice explícitamente', () => {
    render(
      <MemoryRouter>
        <ResultadoOperacion titulo="Listo" detalles={[]} efecto={{ creadas: [], resueltas: [], cambiadas: [] }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Ninguna alerta cambió.')).toBeInTheDocument()
  })
})
