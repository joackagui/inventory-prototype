import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import type { EstadoAjuste, MotivoAjuste, TipoMovimiento } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, consumir, type DatosMovimiento, emitirCambio, masDias, registrar, saldo, type Tx, ubicacionPicking } from '../motor.js';
import { TX } from './comun.js';
import type { AjusteDto } from './ajustes.dto.js';

// Rotura, vencimiento y robo son mermas; la promoción es bonificación; el resto, ajuste.
const TIPO_POR_MOTIVO: Record<MotivoAjuste, TipoMovimiento> = {
  ROTURA: 'MERMA',
  VENCIMIENTO: 'MERMA',
  PERDIDA_ROBO: 'MERMA',
  DIFERENCIA_CONTEO: 'AJUSTE',
  ERROR_REGISTRO: 'AJUSTE',
  PROMOCION: 'BONIFICACION',
};

const detalle = {
  articulo: { select: { codigo: true } },
  almacen: { select: { codigo: true } },
  registradoPor: { select: { codigo: true } },
  aprobadoPor: { select: { codigo: true } },
} as const;

@Injectable()
export class AjustesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Registro (R06): queda PENDIENTE; no mueve stock hasta que R07 lo apruebe.
  async crear(dto: AjusteDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    return this.prisma.$transaction(async (tx) => {
      const almacen = await almacenPlanta(tx, dto.almacen);
      exigirAlmacen(u, almacen.id);
      const articulo = await articuloPorCodigo(tx, dto.articulo);
      let ubicacionId = (await ubicacionPicking(tx, almacen.id, articulo)).id;
      if (dto.capaId) {
        const capa = await tx.capaFifo.findUnique({ where: { id: dto.capaId } });
        if (!capa || capa.articuloId !== articulo.id || capa.almacenId !== almacen.id) throw new ErrorNegocio(400, 'CAPA_INVALIDA', 'La capa no corresponde al artículo y almacén');
        if (dto.cantidad < 0 && -dto.cantidad > capa.cantidadRestante) throw new ErrorNegocio(400, 'CANTIDAD_EXCEDE_CAPA', `La capa solo tiene ${capa.cantidadRestante}`);
        ubicacionId = capa.ubicacionId;
      }
      return tx.ajusteInventario.create({
        data: { articuloId: articulo.id, almacenId: almacen.id, ubicacionId, motivo: dto.motivo, cantidad: dto.cantidad, observacion: dto.observacion, capaId: dto.capaId, registradoPorId: u.id, fechaRegistro: fecha },
        include: detalle,
      });
    }, TX);
  }

  // Aprobación (R07, distinto de quien registró). Baja: consume la capa indicada o FIFO. Alta: capa nueva al costo de la última capa.
  async aprobar(id: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const ajuste = await this.pendiente(tx, id, u);
      const par = { articuloId: ajuste.articuloId, almacenId: ajuste.almacenId };
      await bloquear(tx, [par]);
      if ((await tx.ajusteInventario.findUniqueOrThrow({ where: { id } })).estado !== 'PENDIENTE') throw this.yaResuelto();
      const tipo = TIPO_POR_MOTIVO[ajuste.motivo];
      const base = { tipo, ...par, fechaOperacion: fecha, usuarioId: u.id, motivo: `${ajuste.motivo.replaceAll('_', ' ').toLowerCase()} (ajuste ${id})`, documentoTipo: 'AjusteInventario', documentoId: id };
      const movs: DatosMovimiento[] = [];
      if (ajuste.cantidad < 0) {
        for (const p of await consumir(tx, { ...par, cantidad: -ajuste.cantidad, capaId: ajuste.capaId ?? undefined })) {
          movs.push({ ...base, ubicacionId: p.capa.ubicacionId, capaId: p.capa.id, cantidad: -p.cantidad, costoUnitario: p.capa.costoUnitario });
        }
        const s = await saldo(tx, par, fecha, 0);
        if (s.disponible < 0) throw new ErrorNegocio(409, 'AJUSTE_AFECTA_RESERVAS', 'La baja dejaría menos stock que lo reservado; cancela o reduce pedidos primero', { reservado: s.reservado, fisicoDespues: s.fisico });
      } else {
        const ultima = await tx.capaFifo.findFirst({ where: par, orderBy: [{ fechaEntrada: 'desc' }, { id: 'desc' }] });
        const ubic = await tx.ubicacion.findUniqueOrThrow({ where: { id: ajuste.ubicacionId } });
        const ubicacionId = ubic.vendible ? ubic.id : (await ubicacionPicking(tx, ajuste.almacenId, ajuste.articulo)).id;
        const costo = ultima?.costoUnitario ?? ajuste.articulo.costoFifoInicial;
        const capa = await tx.capaFifo.create({
          data: {
            ...par,
            ubicacionId,
            lote: ultima?.lote ?? `AJ-${id}`,
            fechaEntrada: fecha,
            fechaElaboracion: ultima?.fechaElaboracion ?? fecha,
            fechaVencimiento: ultima?.fechaVencimiento ?? masDias(fecha, ajuste.articulo.vidaUtilDias),
            cantidadInicial: ajuste.cantidad,
            cantidadRestante: ajuste.cantidad,
            costoUnitario: costo,
          },
        });
        movs.push({ ...base, ubicacionId, capaId: capa.id, cantidad: ajuste.cantidad, costoUnitario: costo });
      }
      await registrar(tx, movs);
      const aprobado = await tx.ajusteInventario.update({ where: { id }, data: { estado: 'APROBADO', aprobadoPorId: u.id, fechaResolucion: fecha }, include: detalle });
      return { aprobado, par, movs };
    }, TX);
    emitirCambio(this.eventos, [r.par], 'ajuste_aprobado');
    return { ...r.aprobado, valor: Math.round(r.movs.reduce((s, m) => s + m.cantidad * Number(m.costoUnitario), 0) * 100) / 100 };
  }

  async rechazar(id: number, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const ajuste = await this.pendiente(tx, id, u);
      await bloquear(tx, [{ articuloId: ajuste.articuloId, almacenId: ajuste.almacenId }]);
      if ((await tx.ajusteInventario.findUniqueOrThrow({ where: { id } })).estado !== 'PENDIENTE') throw this.yaResuelto();
      return tx.ajusteInventario.update({ where: { id }, data: { estado: 'RECHAZADO', aprobadoPorId: u.id, fechaResolucion: fecha }, include: detalle });
    }, TX);
    emitirCambio(this.eventos, [r], 'ajuste_rechazado');
    return r;
  }

  listar(estado?: EstadoAjuste) {
    return this.prisma.ajusteInventario.findMany({ where: { estado }, include: detalle, orderBy: { id: 'desc' } });
  }

  private async pendiente(tx: Tx, id: number, u: UsuarioSesion) {
    const ajuste = await tx.ajusteInventario.findUnique({ where: { id }, include: { articulo: true } });
    if (!ajuste) throw noEncontrado(`El ajuste ${id}`);
    if (ajuste.estado !== 'PENDIENTE') throw this.yaResuelto();
    if (ajuste.registradoPorId === u.id) throw new ErrorNegocio(403, 'AUTOAPROBACION', 'Quien registra un ajuste o merma no puede aprobarlo ni rechazarlo');
    return ajuste;
  }

  private yaResuelto() {
    return new ErrorNegocio(409, 'AJUSTE_YA_RESUELTO', 'El ajuste ya fue aprobado o rechazado y no se puede modificar');
  }
}
