import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { bloquear, copiarCapa, emitirCambio, registrar, saldo, type Tx, ubicacion, ubicacionPicking } from '../motor.js';
import { TX } from './comun.js';
import type { CuarentenaDto } from './cuarentena.dto.js';

@Injectable()
export class CuarentenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Pasa una cantidad de una capa a CUAR-01. Si es parcial, divide la capa (mismo lote, costo, vencimiento y fecha de entrada).
  async mover(dto: CuarentenaDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const capa = await this.capa(tx, dto.capaId);
      exigirAlmacen(u, capa.almacenId);
      const par = { articuloId: capa.articuloId, almacenId: capa.almacenId };
      await bloquear(tx, [par]);
      const actual = await tx.capaFifo.findUniqueOrThrow({ where: { id: capa.id } });
      if (actual.estado !== 'DISPONIBLE' || capa.almacen.tipo !== 'PLANTA') throw new ErrorNegocio(409, 'CAPA_NO_DISPONIBLE', 'Solo se pone en cuarentena una capa DISPONIBLE de una planta');
      if (dto.cantidad > actual.cantidadRestante) throw new ErrorNegocio(400, 'CANTIDAD_EXCEDE_CAPA', `La capa solo tiene ${actual.cantidadRestante}`);
      const s = await saldo(tx, par, fecha, 0);
      if (s.disponible - dto.cantidad < 0) throw new ErrorNegocio(409, 'CUARENTENA_AFECTA_RESERVAS', 'No queda stock para cubrir lo reservado', { disponible: s.disponible, reservado: s.reservado });
      const cuar = await ubicacion(tx, capa.almacenId, 'CUAR-01');
      let enCuarentena = actual;
      if (dto.cantidad === actual.cantidadRestante) {
        enCuarentena = await tx.capaFifo.update({ where: { id: actual.id }, data: { estado: 'CUARENTENA', ubicacionId: cuar.id } });
      } else {
        await tx.capaFifo.update({ where: { id: actual.id }, data: { cantidadRestante: actual.cantidadRestante - dto.cantidad } });
        enCuarentena = await copiarCapa(tx, actual, { almacenId: actual.almacenId, ubicacionId: cuar.id, cantidad: dto.cantidad, fechaEntrada: actual.fechaEntrada, estado: 'CUARENTENA' });
      }
      const base = { tipo: 'CUARENTENA' as const, ...par, costoUnitario: actual.costoUnitario, fechaOperacion: fecha, usuarioId: u.id, motivo: `Cuarentena: ${dto.motivo}`, documentoTipo: 'CapaFifo', documentoId: actual.id };
      await registrar(tx, [
        { ...base, ubicacionId: actual.ubicacionId, capaId: actual.id, cantidad: -dto.cantidad },
        { ...base, ubicacionId: cuar.id, capaId: enCuarentena.id, cantidad: dto.cantidad },
      ]);
      return { capa: enCuarentena, par };
    }, TX);
    emitirCambio(this.eventos, [r.par], 'cuarentena');
    return { ...r.capa, costoUnitario: Number(r.capa.costoUnitario) };
  }

  // Libera una capa en cuarentena hacia su ubicación de picking (R07). Para darla de baja se registra un ajuste con su capaId.
  async liberar(capaId: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const capa = await this.capa(tx, capaId);
      const par = { articuloId: capa.articuloId, almacenId: capa.almacenId };
      await bloquear(tx, [par]);
      const actual = await tx.capaFifo.findUniqueOrThrow({ where: { id: capaId } });
      if (actual.estado !== 'CUARENTENA') throw new ErrorNegocio(409, 'CAPA_NO_EN_CUARENTENA', 'La capa no está en cuarentena');
      const pick = await ubicacionPicking(tx, capa.almacenId, capa.articulo);
      const liberada = await tx.capaFifo.update({ where: { id: capaId }, data: { estado: 'DISPONIBLE', ubicacionId: pick.id } });
      const base = { tipo: 'CUARENTENA' as const, ...par, capaId, costoUnitario: actual.costoUnitario, fechaOperacion: fecha, usuarioId: u.id, motivo: 'Liberación de cuarentena', documentoTipo: 'CapaFifo', documentoId: capaId };
      await registrar(tx, [
        { ...base, ubicacionId: actual.ubicacionId, cantidad: -actual.cantidadRestante },
        { ...base, ubicacionId: pick.id, cantidad: actual.cantidadRestante },
      ]);
      return { capa: liberada, par };
    }, TX);
    emitirCambio(this.eventos, [r.par], 'cuarentena_liberada');
    return { ...r.capa, costoUnitario: Number(r.capa.costoUnitario) };
  }

  private async capa(tx: Tx, id: number) {
    const capa = await tx.capaFifo.findUnique({ where: { id }, include: { articulo: true, almacen: true } });
    if (!capa) throw noEncontrado(`La capa ${id}`);
    return capa;
  }
}
