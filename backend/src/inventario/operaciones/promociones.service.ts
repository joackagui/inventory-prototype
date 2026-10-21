import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import type { EstadoPromocion, Promocion } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioSesion } from '../../usuarios/autorizacion.js';
import { aFecha, almacenPlanta, articuloPorCodigo, emitirCambio, type Tx } from '../motor.js';
import { TX } from './comun.js';
import type { AprobarPromocionDto, PromocionDto } from './promociones.dto.js';

const detalle = { articulo: { select: { codigo: true } }, almacen: { select: { codigo: true } }, propuestaPor: { select: { codigo: true } }, aprobadoPor: { select: { codigo: true } } } as const;

@Injectable()
export class PromocionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventEmitter2,
  ) {}

  listar(estado?: EstadoPromocion) {
    return this.prisma.promocion.findMany({ where: { estado }, include: detalle, orderBy: { id: 'desc' } });
  }

  // R02 propone: queda PROPUESTA hasta que R07 la apruebe.
  async proponer(dto: PromocionDto, u: UsuarioSesion) {
    const inicio = aFecha(dto.fechaInicio);
    const fin = aFecha(dto.fechaFin);
    if (fin < inicio) throw new ErrorNegocio(400, 'VIGENCIA_INVALIDA', 'La fecha de fin es anterior a la de inicio');
    return this.prisma.$transaction(async (tx) => {
      const articulo = await articuloPorCodigo(tx, dto.articulo);
      const almacen = dto.almacen ? await almacenPlanta(tx, dto.almacen) : null;
      if (dto.capaId) {
        const capa = await tx.capaFifo.findUnique({ where: { id: dto.capaId } });
        if (!capa || capa.articuloId !== articulo.id || (almacen && capa.almacenId !== almacen.id)) throw new ErrorNegocio(400, 'CAPA_INVALIDA', 'La capa no corresponde al artículo y almacén');
      }
      return tx.promocion.create({
        data: { nombre: dto.nombre, tipo: dto.tipo, articuloId: articulo.id, almacenId: almacen?.id, capaId: dto.capaId, fechaInicio: inicio, fechaFin: fin, topeCajas: dto.topeCajas, descuentoPct: dto.descuentoPct, estado: 'PROPUESTA', propuestaPorId: u.id },
        include: detalle,
      });
    }, TX);
  }

  // R07 aprueba con la referencia del correo del Gerente. No se solapa con otra ACTIVA del mismo tipo, artículo y fechas.
  async aprobar(id: number, dto: AprobarPromocionDto, u: UsuarioSesion) {
    const promo = await this.prisma.$transaction(async (tx) => {
      const p = await this.promocion(tx, id);
      // Candado por artículo: dos aprobaciones simultáneas no pueden solaparse.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${1_000_000 + p.articuloId})`;
      if ((await this.promocion(tx, id)).estado !== 'PROPUESTA') throw new ErrorNegocio(409, 'PROMOCION_NO_PROPUESTA', `La promoción ${p.nombre} está ${p.estado}`);
      const solapada = await tx.promocion.findFirst({
        where: {
          id: { not: id },
          estado: 'ACTIVA',
          tipo: p.tipo,
          articuloId: p.articuloId,
          fechaInicio: { lte: p.fechaFin },
          fechaFin: { gte: p.fechaInicio },
          ...(p.almacenId ? { OR: [{ almacenId: null }, { almacenId: p.almacenId }] } : {}),
        },
      });
      if (solapada) throw new ErrorNegocio(409, 'PROMOCION_SOLAPADA', `Ya hay una promoción ${p.tipo} activa para el artículo en esas fechas: ${solapada.nombre}`, { promocionId: solapada.id });
      return tx.promocion.update({ where: { id }, data: { estado: 'ACTIVA', referenciaCorreo: dto.referenciaCorreo, aprobadoPorId: u.id }, include: detalle });
    }, TX);
    await this.avisar(promo);
    return promo;
  }

  async cerrar(id: number) {
    const promo = await this.prisma.$transaction(async (tx) => {
      const p = await this.promocion(tx, id);
      if (p.estado === 'FINALIZADA') throw new ErrorNegocio(409, 'PROMOCION_FINALIZADA', `La promoción ${p.nombre} ya está cerrada`);
      return tx.promocion.update({ where: { id }, data: { estado: 'FINALIZADA' }, include: detalle });
    }, TX);
    await this.avisar(promo);
    return promo;
  }

  private async promocion(tx: Tx, id: number) {
    const p = await tx.promocion.findUnique({ where: { id } });
    if (!p) throw noEncontrado(`La promoción ${id}`);
    return p;
  }

  // AL15 depende de las promociones activas: reevaluar el artículo en sus almacenes.
  private async avisar(p: Promocion) {
    const almacenes = p.almacenId ? [p.almacenId] : (await this.prisma.almacen.findMany({ where: { tipo: 'PLANTA' } })).map((a) => a.id);
    await emitirCambio(this.eventos, almacenes.map((almacenId) => ({ articuloId: p.articuloId, almacenId })), 'promocion');
  }
}
