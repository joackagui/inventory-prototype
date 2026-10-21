import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import type { EstadoPedido } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, consumir, type DatosMovimiento, emitirCambio, masDias, type Pieza, registrar, resumenConsumo, saldo, type Tx, ubicacionPicking } from '../motor.js';
import { TX } from './comun.js';
import type { PedidoDto } from './pedidos.dto.js';

const conLineas = { lineas: { include: { articulo: { select: { codigo: true, descripcion: true } } } }, cliente: true, almacen: { select: { codigo: true } } } as const;

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Pedido simulado: reserva todo o nada. Si algún artículo no alcanza, queda PENDIENTE_REVISION sin reservas y responde 409.
  async crear(dto: PedidoDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const r = await this.prisma.$transaction(async (tx) => {
      const almacen = await almacenPlanta(tx, dto.almacen);
      const cliente = await tx.cliente.findUnique({ where: { codigo: dto.cliente } });
      if (!cliente) throw noEncontrado(`El cliente ${dto.cliente}`);
      const lineas = [];
      for (const l of dto.lineas) lineas.push({ ...l, articulo: await articuloPorCodigo(tx, l.articulo), bonificacion: !!l.bonificacion });
      await bloquear(tx, lineas.map((l) => ({ articuloId: l.articulo.id, almacenId: almacen.id })));

      // Bonificación en especie: requiere promoción BONIFICACION vigente con tope disponible.
      const promociones = new Map<number, number>();
      const bonificadas = new Map<number, number>();
      for (const l of lineas.filter((x) => x.bonificacion)) bonificadas.set(l.articulo.id, (bonificadas.get(l.articulo.id) ?? 0) + l.cantidad);
      for (const [articuloId, cantidad] of bonificadas) {
        const [promo] = await tx.$queryRaw<{ id: number; topeCajas: number; cajasUsadas: number }[]>`
          SELECT id, "topeCajas", "cajasUsadas" FROM "Promocion"
          WHERE tipo = 'BONIFICACION' AND estado = 'ACTIVA' AND "articuloId" = ${articuloId}
            AND ("almacenId" IS NULL OR "almacenId" = ${almacen.id}) AND "fechaInicio" <= ${fecha} AND "fechaFin" >= ${fecha}
          ORDER BY "fechaFin", id LIMIT 1 FOR UPDATE`;
        const codigo = lineas.find((l) => l.articulo.id === articuloId)!.articulo.codigo;
        if (!promo) throw new ErrorNegocio(409, 'SIN_PROMOCION', `No hay una promoción de bonificación vigente para ${codigo}`);
        if (promo.topeCajas - promo.cajasUsadas < cantidad) {
          throw new ErrorNegocio(409, 'TOPE_PROMOCION', `La promoción de ${codigo} no tiene tope suficiente`, { disponibleEnPromocion: promo.topeCajas - promo.cajasUsadas, solicitado: cantidad });
        }
        promociones.set(articuloId, promo.id);
      }

      const totales = new Map<number, number>();
      for (const l of lineas) totales.set(l.articulo.id, (totales.get(l.articulo.id) ?? 0) + l.cantidad);
      const faltantes = [];
      for (const [articuloId, solicitado] of totales) {
        const s = await saldo(tx, { articuloId, almacenId: almacen.id }, fecha, diasMinimos);
        const vendible = Math.max(0, s.vendible);
        if (vendible < solicitado) faltantes.push({ articulo: lineas.find((l) => l.articulo.id === articuloId)!.articulo.codigo, solicitado, disponible: vendible, faltante: solicitado - vendible });
      }

      const estado: EstadoPedido = faltantes.length ? 'PENDIENTE_REVISION' : 'CONFIRMADO';
      const pedido = await tx.pedidoSimulado.create({
        data: {
          numero: `TMP-${crypto.randomUUID()}`,
          clienteId: cliente.id,
          almacenId: almacen.id,
          estado,
          conFaltante: faltantes.length > 0,
          fechaOperacion: fecha,
          usuarioId: u.id,
          lineas: { create: lineas.map((l) => ({ articuloId: l.articulo.id, cantidad: l.cantidad, bonificacion: l.bonificacion, promocionId: l.bonificacion ? promociones.get(l.articulo.id) : null })) },
        },
      });
      const numero = `PS-${String(pedido.id).padStart(4, '0')}`;
      await tx.pedidoSimulado.update({ where: { id: pedido.id }, data: { numero } });
      if (estado === 'CONFIRMADO') {
        const movs: DatosMovimiento[] = [];
        for (const l of lineas) {
          const ubic = await ubicacionPicking(tx, almacen.id, l.articulo);
          movs.push({ tipo: 'RESERVA', articuloId: l.articulo.id, almacenId: almacen.id, ubicacionId: ubic.id, cantidad: l.cantidad, costoUnitario: 0, fechaOperacion: fecha, usuarioId: u.id, motivo: `Reserva pedido ${numero}`, documentoTipo: 'PedidoSimulado', documentoId: pedido.id });
        }
        await registrar(tx, movs);
        for (const [articuloId, cantidad] of bonificadas) {
          await tx.promocion.update({ where: { id: promociones.get(articuloId)! }, data: { cajasUsadas: { increment: cantidad } } });
        }
      }
      return { pedido: await tx.pedidoSimulado.findUniqueOrThrow({ where: { id: pedido.id }, include: conLineas }), faltantes, pares: [...totales.keys()].map((articuloId) => ({ articuloId, almacenId: almacen.id })) };
    }, TX);

    await emitirCambio(this.eventos, r.pares, r.faltantes.length ? 'pedido_pendiente' : 'reserva');
    if (r.faltantes.length) {
      throw new ErrorNegocio(409, 'STOCK_INSUFICIENTE', `No hay disponible suficiente; el pedido ${r.pedido.numero} quedó pendiente de revisión`, { pedidoId: r.pedido.id, numero: r.pedido.numero, faltantes: r.faltantes });
    }
    return r.pedido;
  }

  // Despacho: FIFO saltando capas con menos de N días de vida o en cuarentena; valora cada pieza con el costo de su capa.
  async despachar(id: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const r = await this.prisma.$transaction(async (tx) => {
      const pedido = await this.pedidoBloqueable(tx, id);
      exigirAlmacen(u, pedido.almacenId);
      await bloquear(tx, pedido.lineas.map((l) => ({ articuloId: l.articuloId, almacenId: pedido.almacenId })));
      const actual = await tx.pedidoSimulado.findUniqueOrThrow({ where: { id } });
      if (actual.estado !== 'CONFIRMADO') throw new ErrorNegocio(409, 'PEDIDO_NO_CONFIRMADO', `El pedido ${pedido.numero} está ${actual.estado}; solo se despachan pedidos confirmados`);
      const movs: DatosMovimiento[] = [];
      const salidas: (Pieza & { articulo: string; bonificacion: boolean })[] = [];
      for (const l of pedido.lineas) {
        const piezas = await consumir(tx, { articuloId: l.articuloId, almacenId: pedido.almacenId, cantidad: l.cantidad, venceDesde: masDias(fecha, diasMinimos) });
        for (const p of piezas) {
          movs.push({
            tipo: l.bonificacion ? 'BONIFICACION' : 'SALIDA',
            articuloId: l.articuloId,
            almacenId: pedido.almacenId,
            ubicacionId: p.capa.ubicacionId,
            capaId: p.capa.id,
            cantidad: -p.cantidad,
            costoUnitario: p.capa.costoUnitario,
            fechaOperacion: fecha,
            usuarioId: u.id,
            motivo: l.bonificacion ? 'promoción' : `Despacho pedido ${pedido.numero}`,
            documentoTipo: 'PedidoSimulado',
            documentoId: pedido.id,
          });
          salidas.push({ ...p, articulo: l.articulo.codigo, bonificacion: l.bonificacion });
        }
      }
      await registrar(tx, movs);
      await tx.pedidoSimulado.update({ where: { id }, data: { estado: 'DESPACHADO', fechaDespacho: fecha } });
      return { pedido, salidas };
    }, TX);
    await emitirCambio(this.eventos, r.pedido.lineas.map((l) => ({ articuloId: l.articuloId, almacenId: r.pedido.almacenId })), 'despacho');
    const { capasConsumidas, costoTotal } = resumenConsumo(r.salidas);
    return {
      pedido: r.pedido.numero,
      estado: 'DESPACHADO',
      capasConsumidas: capasConsumidas.map((c, i) => ({ ...c, articulo: r.salidas[i].articulo, bonificacion: r.salidas[i].bonificacion })),
      costoTotal,
    };
  }

  // Cancelación: libera la reserva (movimiento de control) y devuelve el tope de la promoción.
  async cancelar(id: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const pedido = await this.prisma.$transaction(async (tx) => {
      const pedido = await this.pedidoBloqueable(tx, id);
      exigirAlmacen(u, pedido.almacenId);
      await bloquear(tx, pedido.lineas.map((l) => ({ articuloId: l.articuloId, almacenId: pedido.almacenId })));
      const actual = await tx.pedidoSimulado.findUniqueOrThrow({ where: { id } });
      if (actual.estado !== 'CONFIRMADO' && actual.estado !== 'PENDIENTE_REVISION') {
        throw new ErrorNegocio(409, 'PEDIDO_NO_CANCELABLE', `El pedido ${pedido.numero} está ${actual.estado}`);
      }
      if (actual.estado === 'CONFIRMADO') {
        const movs: DatosMovimiento[] = [];
        for (const l of pedido.lineas) {
          const ubic = await ubicacionPicking(tx, pedido.almacenId, l.articulo);
          movs.push({ tipo: 'LIBERACION_RESERVA', articuloId: l.articuloId, almacenId: pedido.almacenId, ubicacionId: ubic.id, cantidad: -l.cantidad, costoUnitario: 0, fechaOperacion: fecha, usuarioId: u.id, motivo: `Cancelación pedido ${pedido.numero}`, documentoTipo: 'PedidoSimulado', documentoId: id });
          if (l.promocionId) await tx.promocion.update({ where: { id: l.promocionId }, data: { cajasUsadas: { decrement: l.cantidad } } });
        }
        await registrar(tx, movs);
      }
      return tx.pedidoSimulado.update({ where: { id }, data: { estado: 'CANCELADO' }, include: conLineas });
    }, TX);
    await emitirCambio(this.eventos, pedido.lineas.map((l) => ({ articuloId: l.articuloId, almacenId: pedido.almacenId })), 'cancelacion');
    return pedido;
  }

  async listar(filtro: { estado?: EstadoPedido; almacen?: string }) {
    const fecha = await this.simulacion.fechaOperacion();
    const pedidos = await this.prisma.pedidoSimulado.findMany({
      where: { estado: filtro.estado, almacen: filtro.almacen ? { codigo: filtro.almacen } : undefined },
      include: conLineas,
      orderBy: { id: 'desc' },
    });
    return pedidos.map((p) => ({ ...p, antiguedadDias: Math.round((fecha.getTime() - p.fechaOperacion.getTime()) / 86_400_000) }));
  }

  async detalle(id: number) {
    const fecha = await this.simulacion.fechaOperacion();
    const p = await this.prisma.pedidoSimulado.findUnique({ where: { id }, include: { ...conLineas, usuario: { select: { codigo: true } } } });
    if (!p) throw noEncontrado(`El pedido ${id}`);
    const movimientos = await this.prisma.movimiento.findMany({
      where: { documentoTipo: 'PedidoSimulado', documentoId: id },
      include: { articulo: { select: { codigo: true } }, capa: { select: { lote: true } }, usuario: { select: { codigo: true } } },
      orderBy: { id: 'asc' },
    });
    return { ...p, antiguedadDias: Math.round((fecha.getTime() - p.fechaOperacion.getTime()) / 86_400_000), movimientos };
  }

  private async pedidoBloqueable(tx: Tx, id: number) {
    const pedido = await tx.pedidoSimulado.findUnique({ where: { id }, include: { lineas: { include: { articulo: true } } } });
    if (!pedido) throw noEncontrado(`El pedido ${id}`);
    return pedido;
  }
}
