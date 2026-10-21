import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import type { EstadoTraslado } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, consumir, copiarCapa, type DatosMovimiento, emitirCambio, masDias, type Par, type Pieza, registrar, resumenConsumo, saldo, type Tx, ubicacion, ubicacionPicking } from '../motor.js';
import { obtenerStock, resolverAlmacen } from '../stock.js';
import { TX } from './comun.js';
import type { RecepcionTrasladoDto, TrasladoDto } from './traslados.dto.js';

const detalle = { origen: { select: { codigo: true } }, destino: { select: { codigo: true } }, lineas: { include: { articulo: { select: { codigo: true } } } } } as const;

@Injectable()
export class TrasladosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Por artículo con posición ≤ ROP: traslado propuesto (Máx − posición) y origen con más cobertura sobre su ROP.
  async propuesta(almacenParam: string) {
    const destino = await resolverAlmacen(this.prisma, almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const otros = await this.prisma.almacen.findMany({ where: { tipo: 'PLANTA', id: { not: destino.id } } });
    const stockOtros = await Promise.all(otros.map(async (a) => ({ almacen: a, stock: await obtenerStock(this.prisma, a.id, fecha, diasMinimos) })));
    const stock = await obtenerStock(this.prisma, destino.id, fecha, diasMinimos);
    return stock
      .filter((s) => s.trasladoPropuesto > 0)
      .map((s) => {
        const candidatos = stockOtros
          .map(({ almacen, stock: st }) => {
            const o = st.find((x) => x.articuloId === s.articuloId)!;
            // Lo que el origen puede ceder sin bajar de su ROP (y que se puede despachar hoy).
            const excedente = Math.min(o.disponible - o.rop, o.vendible);
            return { almacen: almacen.codigo, disponible: o.disponible, rop: o.rop, excedente, coberturaSobreRop: Math.round(((o.disponible - o.rop) / o.demandaDiaria) * 10) / 10 };
          })
          .sort((a, b) => b.coberturaSobreRop - a.coberturaSobreRop);
        const mejor = candidatos[0]?.excedente > 0 ? candidatos[0] : null;
        return {
          articulo: s.codigo,
          descripcion: s.descripcion,
          posicion: s.posicion,
          rop: s.rop,
          stockMaximo: s.stockMaximo,
          trasladoPropuesto: s.trasladoPropuesto,
          origenSugerido: mejor?.almacen ?? null,
          cantidadSugerida: mejor ? Math.min(s.trasladoPropuesto, mejor.excedente) : 0,
          candidatos,
        };
      });
  }

  async crear(dto: TrasladoDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    return this.prisma.$transaction(async (tx) => {
      const origen = await almacenPlanta(tx, dto.origen);
      const destino = await almacenPlanta(tx, dto.destino);
      if (origen.id === destino.id) throw new ErrorNegocio(400, 'TRASLADO_INVALIDO', 'El origen y el destino deben ser distintos');
      const codigos = dto.lineas.map((l) => l.articulo);
      if (new Set(codigos).size !== codigos.length) throw new ErrorNegocio(400, 'TRASLADO_INVALIDO', 'Cada artículo debe aparecer una sola vez');
      const lineas = [];
      for (const l of dto.lineas) lineas.push({ articuloId: (await articuloPorCodigo(tx, l.articulo)).id, cantidadDespachada: l.cantidad });
      const orden = await tx.ordenTraslado.create({
        data: { numero: `TMP-${crypto.randomUUID()}`, origenId: origen.id, destinoId: destino.id, estado: 'EMITIDA', fechaEmision: fecha, usuarioId: u.id, lineas: { create: lineas } },
      });
      return tx.ordenTraslado.update({ where: { id: orden.id }, data: { numero: `OT-${fecha.getUTCFullYear()}-${String(orden.id).padStart(4, '0')}` }, include: detalle });
    }, TX);
  }

  // Despacho (R06 del origen): FIFO del origen → capas equivalentes en el tránsito del destino (mismo lote, costo y vencimiento).
  async despachar(id: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const r = await this.prisma.$transaction(async (tx) => {
      const orden = await this.orden(tx, id);
      exigirAlmacen(u, orden.origenId);
      const pares = orden.lineas.flatMap((l) => [{ articuloId: l.articuloId, almacenId: orden.origenId }, { articuloId: l.articuloId, almacenId: orden.destinoId }]);
      await bloquear(tx, pares);
      const actual = await tx.ordenTraslado.findUniqueOrThrow({ where: { id } });
      if (actual.estado !== 'EMITIDA') throw new ErrorNegocio(409, 'TRASLADO_YA_DESPACHADO', `El traslado ${orden.numero} está ${actual.estado}`);
      const transitoId = orden.destino.almacenTransitoId!;
      const enRuta = await ubicacion(tx, transitoId, 'EN-RUTA');
      const movs: DatosMovimiento[] = [];
      const consumidas: Pieza[] = [];
      for (const l of orden.lineas) {
        const s = await saldo(tx, { articuloId: l.articuloId, almacenId: orden.origenId }, fecha, diasMinimos);
        if (s.vendible < l.cantidadDespachada) {
          throw new ErrorNegocio(409, 'STOCK_INSUFICIENTE', `El origen no tiene disponible suficiente de ${l.articulo.codigo}`, { disponible: Math.max(0, s.vendible), solicitado: l.cantidadDespachada });
        }
        const piezas = await consumir(tx, { articuloId: l.articuloId, almacenId: orden.origenId, cantidad: l.cantidadDespachada, venceDesde: masDias(fecha, diasMinimos) });
        consumidas.push(...piezas);
        for (const p of piezas) {
          const nueva = await copiarCapa(tx, p.capa, { almacenId: transitoId, ubicacionId: enRuta.id, cantidad: p.cantidad, fechaEntrada: fecha, ordenTrasladoId: id });
          const base = { articuloId: l.articuloId, costoUnitario: p.capa.costoUnitario, fechaOperacion: fecha, usuarioId: u.id, motivo: `Traslado ${orden.numero}`, documentoTipo: 'OrdenTraslado', documentoId: id };
          movs.push({ ...base, tipo: 'TRASLADO_SALIDA', almacenId: orden.origenId, ubicacionId: p.capa.ubicacionId, capaId: p.capa.id, cantidad: -p.cantidad });
          movs.push({ ...base, tipo: 'TRASLADO_ENTRADA', almacenId: transitoId, ubicacionId: enRuta.id, capaId: nueva.id, cantidad: p.cantidad });
        }
      }
      await registrar(tx, movs);
      return { orden: await tx.ordenTraslado.update({ where: { id }, data: { estado: 'EN_TRANSITO', fechaDespacho: fecha }, include: detalle }), pares, consumidas };
    }, TX);
    await emitirCambio(this.eventos, r.pares, 'traslado_despacho');
    return { ...r.orden, ...resumenConsumo(r.consumidas) };
  }

  // Recepción (R06 del destino). La diferencia (despachado − recibido) queda registrada primero como ajuste PENDIENTE
  // sobre el stock en tránsito (R07 decide); lo recibido pasa al destino (dañado → CUAR-01). Un traslado no se recibe dos veces.
  async recibir(id: number, dto: RecepcionTrasladoDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const orden = await this.orden(tx, id);
      exigirAlmacen(u, orden.destinoId);
      const pares: Par[] = orden.lineas.map((l) => ({ articuloId: l.articuloId, almacenId: orden.destinoId }));
      await bloquear(tx, pares);
      const actual = await tx.ordenTraslado.findUniqueOrThrow({ where: { id } });
      if (actual.estado === 'RECIBIDA' || actual.estado === 'CON_DIFERENCIA') throw new ErrorNegocio(409, 'TRASLADO_YA_RECIBIDO', `El traslado ${orden.numero} ya fue recibido`);
      if (actual.estado !== 'EN_TRANSITO') throw new ErrorNegocio(409, 'TRASLADO_NO_DESPACHADO', `El traslado ${orden.numero} todavía no fue despachado`);
      const transitoId = orden.destino.almacenTransitoId!;
      const enRuta = await ubicacion(tx, transitoId, 'EN-RUTA');
      const cuarentena = await ubicacion(tx, orden.destinoId, 'CUAR-01');
      let conDiferencia = false;
      const movs: DatosMovimiento[] = [];
      const consumidas: Pieza[] = [];
      for (const l of orden.lineas) {
        const recibida = dto.lineas.find((x) => x.articulo === l.articulo.codigo);
        if (!recibida) throw new ErrorNegocio(400, 'RECEPCION_INCOMPLETA', `Falta la cantidad recibida de ${l.articulo.codigo}`);
        if (recibida.cantidadRecibida > l.cantidadDespachada) throw new ErrorNegocio(400, 'CANTIDAD_RECIBIDA_MAYOR', `Se recibió más ${l.articulo.codigo} de lo despachado (${l.cantidadDespachada})`);
        const diferencia = l.cantidadDespachada - recibida.cantidadRecibida;
        const danado = recibida.estado === 'DANADO';
        conDiferencia ||= diferencia > 0 || danado;
        await tx.lineaTraslado.update({ where: { id: l.id }, data: { cantidadRecibida: recibida.cantidadRecibida, estadoRecepcion: recibida.estado ?? 'CONFORME', observacion: recibida.observacion ?? (diferencia ? `Diferencia de ${diferencia}` : null) } });
        const base = { articuloId: l.articuloId, fechaOperacion: fecha, usuarioId: u.id, documentoTipo: 'OrdenTraslado', documentoId: id };
        if (diferencia > 0) {
          await tx.ajusteInventario.create({
            data: {
              articuloId: l.articuloId,
              almacenId: transitoId,
              ubicacionId: enRuta.id,
              motivo: 'DIFERENCIA_RECEPCION',
              cantidad: -diferencia,
              observacion: `Diferencia en recepción ${orden.numero}: despachado ${l.cantidadDespachada}, recibido ${recibida.cantidadRecibida}`,
              ordenTrasladoId: id,
              registradoPorId: u.id,
              fechaRegistro: fecha,
            },
          });
        }
        if (recibida.cantidadRecibida > 0) {
          const destinoUbic = danado ? cuarentena : await ubicacionPicking(tx, orden.destinoId, l.articulo);
          for (const p of await consumir(tx, { articuloId: l.articuloId, almacenId: transitoId, cantidad: recibida.cantidadRecibida, ordenTrasladoId: id })) {
            consumidas.push(p);
            // La capa recibida recuerda su traslado (AL09 sigue la mercadería dañada hasta que sale de cuarentena).
            const nueva = await copiarCapa(tx, p.capa, { almacenId: orden.destinoId, ubicacionId: destinoUbic.id, cantidad: p.cantidad, fechaEntrada: fecha, estado: danado ? 'CUARENTENA' : 'DISPONIBLE', ordenTrasladoId: id });
            const mov = { ...base, costoUnitario: p.capa.costoUnitario, motivo: `Recepción traslado ${orden.numero}` };
            movs.push({ ...mov, tipo: 'TRASLADO_SALIDA', almacenId: transitoId, ubicacionId: enRuta.id, capaId: p.capa.id, cantidad: -p.cantidad });
            movs.push({ ...mov, tipo: 'TRASLADO_ENTRADA', almacenId: orden.destinoId, ubicacionId: destinoUbic.id, capaId: nueva.id, cantidad: p.cantidad });
          }
        }
      }
      await registrar(tx, movs);
      const estado: EstadoTraslado = conDiferencia ? 'CON_DIFERENCIA' : 'RECIBIDA';
      return { orden: await tx.ordenTraslado.update({ where: { id }, data: { estado, fechaRecepcion: fecha }, include: detalle }), pares, consumidas };
    }, TX);
    await emitirCambio(this.eventos, r.pares, 'traslado_recepcion');
    return { ...r.orden, ...resumenConsumo(r.consumidas) };
  }

  // Detalle con líneas, capas que siguen en tránsito, diferencias pendientes y movimientos.
  async detalle(id: number) {
    const orden = await this.prisma.ordenTraslado.findUnique({ where: { id }, include: { ...detalle, usuario: { select: { codigo: true } }, ajustes: { select: { id: true, estado: true, cantidad: true, articuloId: true } } } });
    if (!orden) throw noEncontrado(`El traslado ${id}`);
    const [movimientos, enTransito] = [
      await this.prisma.movimiento.findMany({
        where: { documentoTipo: 'OrdenTraslado', documentoId: id },
        include: { almacen: { select: { codigo: true } }, articulo: { select: { codigo: true } }, capa: { select: { lote: true } }, usuario: { select: { codigo: true } } },
        orderBy: { id: 'asc' },
      }),
      await this.prisma.capaFifo.findMany({ where: { ordenTrasladoId: id, cantidadRestante: { gt: 0 }, almacen: { tipo: 'TRANSITO' } }, select: { id: true, lote: true, cantidadRestante: true, costoUnitario: true } }),
    ];
    return { ...orden, movimientos, enTransito: enTransito.map((c) => ({ ...c, costoUnitario: Number(c.costoUnitario) })) };
  }

  listar(estado?: EstadoTraslado) {
    return this.prisma.ordenTraslado.findMany({ where: { estado }, include: detalle, orderBy: { id: 'desc' } });
  }

  private async orden(tx: Tx, id: number) {
    const orden = await tx.ordenTraslado.findUnique({ where: { id }, include: { destino: true, lineas: { include: { articulo: true } } } });
    if (!orden) throw noEncontrado(`El traslado ${id}`);
    return orden;
  }
}
