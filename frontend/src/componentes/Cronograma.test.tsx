import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Cronograma } from './Cronograma'

describe('Cronograma de hitos', () => {
  it('muestra estado con texto, fechas, responsables y acción', () => {
    render(
      <Cronograma
        hitos={[
          { clave: '3-semanas', titulo: '3 semanas antes', desde: '2027-06-25', hasta: '2027-07-01', estado: 'EN_CURSO', responsables: ['R06', 'R07'], accion: 'Revisar vencimientos.' },
          { clave: 'durante', titulo: 'Durante la fiesta', desde: '2027-07-16', hasta: '2027-08-06', estado: 'PROXIMO', responsables: ['R07', 'R02'], accion: 'Revisión diaria.' },
          { clave: 'preparacion', titulo: 'Inicio', desde: '2027-06-18', hasta: '2027-06-18', estado: 'PASADO', responsables: ['R07'], accion: 'Pronóstico.' },
        ]}
      />,
    )
    const [enCurso, proximo, hecho] = screen.getAllByRole('listitem')
    expect(within(enCurso).getByText('En curso')).toBeInTheDocument()
    expect(enCurso).toHaveTextContent('25/06/2027 – 01/07/2027')
    expect(enCurso).toHaveTextContent('R06 · R07')
    expect(within(proximo).getByText('Próximo')).toBeInTheDocument()
    expect(within(hecho).getByText('Hecho')).toBeInTheDocument()
    expect(hecho).not.toHaveTextContent('–') // un solo día: sin rango
  })
})
