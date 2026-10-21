import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio } from '../../comun/errores.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { aFecha, almacenPlanta, articuloPorCodigo, bloquear, emitirCambio, masDias, registrar, ubicacion } from '../motor.js';
import { TX } from './comun.js';
import type { RecepcionDto } from './recepcion.dto.js';

@Injectable()
export class RecepcionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Entrada por producción de planta: crea una capa FIFO y su movimiento ENTRADA.
  async registrar(dto: RecepcionDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const capa = await this.prisma.$transaction(async (tx) => {
      const almacen = await almacenPlanta(tx, dto.almacen);
      exigirAlmacen(u, almacen.id);
      const articulo = await articuloPorCodigo(tx, dto.articulo);
      const ubic = await ubicacion(tx, almacen.id, dto.ubicacion);
      if (!ubic.vendible) throw new ErrorNegocio(400, 'UBICACION_NO_VALIDA', `No se recibe producción en ${ubic.codigo}`);
      const elaboracion = aFecha(dto.fechaElaboracion);
      if (elaboracion > fecha) throw new ErrorNegocio(400, 'FECHA_ELABORACION_FUTURA', 'La fecha de elaboración es posterior a la fecha de operación');
      const vencimiento = masDias(elaboracion, articulo.vidaUtilDias);
      if (vencimiento <= fecha) throw new ErrorNegocio(400, 'LOTE_VENCIDO', 'El lote ya está vencido');
      await bloquear(tx, [{ articuloId: articulo.id, almacenId: almacen.id }]);
      const nueva = await tx.capaFifo.create({
        data: {
          articuloId: articulo.id,
          almacenId: almacen.id,
          ubicacionId: ubic.id,
          lote: dto.lote,
          fechaEntrada: fecha,
          fechaElaboracion: elaboracion,
          fechaVencimiento: vencimiento,
          cantidadInicial: dto.cantidad,
          cantidadRestante: dto.cantidad,
          costoUnitario: dto.costoUnitario,
        },
      });
      await registrar(tx, [
        { tipo: 'ENTRADA', articuloId: articulo.id, almacenId: almacen.id, ubicacionId: ubic.id, capaId: nueva.id, cantidad: dto.cantidad, costoUnitario: dto.costoUnitario, fechaOperacion: fecha, usuarioId: u.id, motivo: 'Recepción de producción', documentoTipo: 'Recepcion' },
      ]);
      return nueva;
    }, TX);
    emitirCambio(this.eventos, [capa], 'recepcion');
    return { ...capa, costoUnitario: Number(capa.costoUnitario) };
  }
}
