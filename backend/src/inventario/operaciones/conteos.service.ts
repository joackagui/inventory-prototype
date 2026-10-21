import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, emitirCambio, registrar, ubicacion } from '../motor.js';
import { TX } from './comun.js';
import type { ConteoDto } from './conteos.dto.js';

@Injectable()
export class ConteosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Conteo por ubicación: compara contado vs. sistema, actualiza ultimoConteo y, si hay diferencia, deja un ajuste PENDIENTE.
  async registrar(dto: ConteoDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const tolerancia = await this.simulacion.valor('toleranciaConteoPct', 0.5);
    const r = await this.prisma.$transaction(async (tx) => {
      const almacen = await almacenPlanta(tx, dto.almacen);
      exigirAlmacen(u, almacen.id);
      const articulo = await articuloPorCodigo(tx, dto.articulo);
      const ubic = await ubicacion(tx, almacen.id, dto.ubicacion);
      const par = { articuloId: articulo.id, almacenId: almacen.id };
      await bloquear(tx, [par]);
      const capas = await tx.capaFifo.aggregate({ where: { ...par, ubicacionId: ubic.id, estado: { not: 'AGOTADA' } }, _sum: { cantidadRestante: true } });
      const sistema = capas._sum.cantidadRestante ?? 0;
      const diferencia = dto.cantidadContada - sistema;
      const porcentaje = sistema ? Math.round((Math.abs(diferencia) / sistema) * 10000) / 100 : diferencia ? 100 : 0;
      const conteo = await tx.conteoFisico.create({
        data: { tipo: dto.tipo, ...par, ubicacionId: ubic.id, cantidadSistema: sistema, cantidadContada: dto.cantidadContada, diferencia, porcentaje, requiereRecuento: porcentaje > tolerancia, usuarioId: u.id, fechaOperacion: fecha },
      });
      await registrar(tx, [
        { tipo: 'CONTEO', ...par, ubicacionId: ubic.id, cantidad: diferencia, costoUnitario: 0, fechaOperacion: fecha, usuarioId: u.id, motivo: `Conteo ${dto.tipo.toLowerCase()}: sistema ${sistema}, contado ${dto.cantidadContada}`, documentoTipo: 'ConteoFisico', documentoId: conteo.id },
      ]);
      await tx.parametroArticuloAlmacen.update({ where: { articuloId_almacenId: par }, data: { ultimoConteo: fecha } });
      const ajuste = diferencia
        ? await tx.ajusteInventario.create({
            data: { ...par, ubicacionId: ubic.id, motivo: 'DIFERENCIA_CONTEO', cantidad: diferencia, observacion: `Conteo ${conteo.id}: ${porcentaje}%`, conteoId: conteo.id, registradoPorId: u.id, fechaRegistro: fecha },
          })
        : null;
      return { conteo, ajuste, par };
    }, TX);
    emitirCambio(this.eventos, [r.par], 'conteo');
    return { conteo: r.conteo, ajuste: r.ajuste, toleranciaPct: tolerancia };
  }

  listar(almacen?: string) {
    return this.prisma.conteoFisico.findMany({
      where: { almacen: almacen ? { codigo: almacen } : undefined },
      include: { articulo: { select: { codigo: true } }, almacen: { select: { codigo: true } }, ubicacion: { select: { codigo: true } }, usuario: { select: { codigo: true } } },
      orderBy: { id: 'desc' },
    });
  }
}
