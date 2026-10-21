import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Capa } from '../api/tipos'
import { ColaFifo } from './ColaFifo'
import { colorVida, VidaRestante } from './VidaRestante'

const capa = (id: number, lote: string, vida: number, extra: Partial<Capa> = {}): Capa => ({
  id,
  lote,
  almacen: { codigo: 'CD-LP-01', tipo: 'PLANTA' },
  ubicacion: { codigo: 'PICK-A' },
  fechaEntrada: '2027-06-18',
  fechaElaboracion: '2027-05-18',
  fechaVencimiento: '2027-11-14',
  cantidadInicial: 360,
  cantidadRestante: 360,
  costoUnitario: 12.4,
  estado: 'DISPONIBLE',
  vidaRestanteDias: vida,
  valor: 4464,
  despachable: true,
  proximaEnSalir: false,
  ...extra,
})

describe('Cola FIFO', () => {
  it('va de la entrada (la más nueva) a la salida (la más antigua) y marca la próxima en salir', () => {
    render(<ColaFifo capas={[capa(1, 'VIEJA', 12, { despachable: false, motivoNoDespachable: 'Menos de 15 días de vida' }), capa(2, 'MEDIA', 25, { proximaEnSalir: true }), capa(3, 'NUEVA', 137)]} />)
    const items = within(screen.getByRole('list', { name: /Cola FIFO/ })).getAllByRole('listitem')
    expect(items.map((i) => i.querySelector('[data-capa]')?.getAttribute('data-capa'))).toEqual(['NUEVA', 'MEDIA', 'VIEJA'])
    expect(within(items[1]).getByText('Próxima en salir')).toBeInTheDocument()
    expect(within(items[2]).getByText('No despachable')).toBeInTheDocument()
  })
})

describe('Barra de vida restante', () => {
  it('verde > 30 días, amarillo 15–30, rojo < 15', () => {
    expect([31, 30, 15, 14].map(colorVida)).toEqual(['VERDE', 'AMARILLO', 'AMARILLO', 'ROJO'])
  })

  it('muestra los días y expone un medidor accesible', () => {
    render(<VidaRestante dias={12} vidaUtil={180} />)
    expect(screen.getByRole('meter', { name: 'Vida restante: 12 días de 180' })).toHaveAttribute('aria-valuenow', '12')
    expect(screen.getByTestId('vida-restante')).toHaveAttribute('data-color', 'ROJO')
  })
})
