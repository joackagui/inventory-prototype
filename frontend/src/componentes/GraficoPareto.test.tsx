import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraficoPareto } from './GraficoPareto'

describe('Gráfico de Pareto', () => {
  it('describe barras, % acumulado y clase para lectores de pantalla', () => {
    render(
      <GraficoPareto
        datos={[
          { etiqueta: '10021', valor: 2244, porcentajeAcumulado: 35.36, grupo: 'A' },
          { etiqueta: '10022', valor: 1533, porcentajeAcumulado: 59.52, grupo: 'A' },
          { etiqueta: '10035', valor: 963, porcentajeAcumulado: 74.69, grupo: 'A' },
        ]}
      />,
    )
    expect(screen.getByTestId('grafico-pareto')).toHaveAccessibleName(
      'Pareto. 10021: USD 2,244.00, 35.4% acumulado, clase A; 10022: USD 1,533.00, 59.5% acumulado, clase A; 10035: USD 963.00, 74.7% acumulado, clase A',
    )
  })

  it('acepta otro formato de valor (unidades, sin clase)', () => {
    render(<GraficoPareto datos={[{ etiqueta: 'ROTURA', valor: 76.8, porcentajeAcumulado: 100 }]} formatoValor={(n) => `${n} u.`} />)
    expect(screen.getByTestId('grafico-pareto')).toHaveAccessibleName('Pareto. ROTURA: 76.8 u., 100.0% acumulado')
  })
})
