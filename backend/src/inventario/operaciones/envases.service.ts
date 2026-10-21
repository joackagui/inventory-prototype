import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, emitirCambio, registrar, type Tx, ubicacion } from '../motor.js';
import { TX } from './comun.js';
import type { EnvaseDto } from './envases.dto.js';

const MS_DIA = 86_400_000;

@Injectable()
export class EnvasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Envases retornables: control por cantidad (sin FIFO), con movimientos de control en ENV-RET.
  async registrar(tipo: 'entrega' | 'devolucion', dto: EnvaseDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const { almacen, articulo, cliente, envRet } = await this.resolver(tx, dto);
      exigirAlmacen(u, almacen.id);
      const par = { articuloId: articulo.id, almacenId: almacen.id };
      await bloquear(tx, [par]);
      if (tipo === 'entrega') {
        await tx.saldoEnvase.create({ data: { clienteId: cliente.id, ...par, cantidadEntregada: dto.cantidad, fechaEntrega: fecha } });
      } else {
        // Se descuenta de las entregas más antiguas primero.
        const saldos = await tx.saldoEnvase.findMany({ where: { clienteId: cliente.id, ...par }, orderBy: [{ fechaEntrega: 'asc' }, { id: 'asc' }] });
        const pendiente = saldos.reduce((s, x) => s + x.cantidadEntregada - x.cantidadDevuelta, 0);
        if (dto.cantidad > pendiente) throw new ErrorNegocio(409, 'DEVOLUCION_EXCEDE', `${cliente.codigo} solo tiene ${pendiente} envases pendientes de ${articulo.codigo}`, { pendiente });
        let resto = dto.cantidad;
        for (const s of saldos) {
          const n = Math.min(resto, s.cantidadEntregada - s.cantidadDevuelta);
          if (n > 0) await tx.saldoEnvase.update({ where: { id: s.id }, data: { cantidadDevuelta: s.cantidadDevuelta + n } });
          resto -= n;
        }
      }
      await registrar(tx, [
        {
          tipo: tipo === 'entrega' ? 'ENVASE_ENTREGA' : 'ENVASE_DEVOLUCION',
          ...par,
          ubicacionId: envRet.id,
          cantidad: tipo === 'entrega' ? -dto.cantidad : dto.cantidad,
          costoUnitario: 0,
          fechaOperacion: fecha,
          usuarioId: u.id,
          motivo: `Envases ${tipo === 'entrega' ? 'entregados a' : 'devueltos por'} ${cliente.codigo}`,
          documentoTipo: 'SaldoEnvase',
        },
      ]);
      return { par, pendiente: await this.pendienteCliente(tx, cliente.id, par) };
    }, TX);
    await emitirCambio(this.eventos, [r.par], `envase_${tipo}`);
    return { cliente: dto.cliente, articulo: dto.articulo, pendiente: r.pendiente };
  }

  async saldos(filtro: { cliente?: string; almacen?: string }) {
    const fecha = await this.simulacion.fechaOperacion();
    const filas = await this.prisma.saldoEnvase.findMany({
      where: { cliente: filtro.cliente ? { codigo: filtro.cliente } : undefined, almacen: filtro.almacen ? { codigo: filtro.almacen } : undefined },
      include: { cliente: { select: { codigo: true } }, articulo: { select: { codigo: true } }, almacen: { select: { codigo: true } } },
      orderBy: [{ fechaEntrega: 'asc' }, { id: 'asc' }],
    });
    return filas.map((f) => ({ ...f, pendiente: f.cantidadEntregada - f.cantidadDevuelta, antiguedadDias: Math.round((fecha.getTime() - f.fechaEntrega.getTime()) / MS_DIA) }));
  }

  private async resolver(tx: Tx, dto: EnvaseDto) {
    const almacen = await almacenPlanta(tx, dto.almacen);
    const articulo = await articuloPorCodigo(tx, dto.articulo);
    if (!articulo.esRetornable) throw new ErrorNegocio(400, 'ARTICULO_NO_RETORNABLE', `${articulo.codigo} no usa envase retornable`);
    const cliente = await tx.cliente.findUnique({ where: { codigo: dto.cliente } });
    if (!cliente) throw noEncontrado(`El cliente ${dto.cliente}`);
    return { almacen, articulo, cliente, envRet: await ubicacion(tx, almacen.id, 'ENV-RET') };
  }

  private async pendienteCliente(tx: Tx, clienteId: number, par: { articuloId: number; almacenId: number }) {
    const s = await tx.saldoEnvase.aggregate({ where: { clienteId, ...par }, _sum: { cantidadEntregada: true, cantidadDevuelta: true } });
    return (s._sum.cantidadEntregada ?? 0) - (s._sum.cantidadDevuelta ?? 0);
  }
}
