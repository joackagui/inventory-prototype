import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../../comun/errores.js';
import type { EstadoAjuste, MotivoAjuste, TipoMovimiento } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import { exigirAlmacen, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { almacenPlanta, articuloPorCodigo, bloquear, consumir, copiarCapa, type DatosMovimiento, emitirCambio, masDias, type Par, type Pieza, registrar, resumenConsumo, saldo, type Tx, ubicacionPicking, valorarAjuste } from '../motor.js';
import { TX } from './comun.js';
import type { AjusteDto, ImpactoAjusteDto } from './ajustes.dto.js';

// Rotura, vencimiento y robo son mermas; la promoción es bonificación; el resto, ajuste.
const TIPO_POR_MOTIVO: Record<MotivoAjuste, TipoMovimiento> = {
  ROTURA: 'MERMA',
  VENCIMIENTO: 'MERMA',
  PERDIDA_ROBO: 'MERMA',
  DIFERENCIA_CONTEO: 'AJUSTE',
  ERROR_REGISTRO: 'AJUSTE',
  PROMOCION: 'BONIFICACION',
  DIFERENCIA_RECEPCION: 'MERMA',
};

const detalle = {
  articulo: { select: { codigo: true, descripcion: true } },
  almacen: { select: { codigo: true, tipo: true } },
  capa: { select: { lote: true, fechaVencimiento: true, estado: true } },
  ordenTraslado: { select: { id: true, numero: true } },
  conteo: { select: { id: true, cantidadSistema: true, cantidadContada: true, porcentaje: true } },
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
    if (dto.motivo === 'DIFERENCIA_RECEPCION') throw new ErrorNegocio(400, 'MOTIVO_RESERVADO', 'La diferencia en recepción se registra al recibir el traslado');
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
  async aprobar(id: number, u: UsuarioSesion, comentario?: string) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const ajuste = await this.pendiente(tx, id, u);
      const par = { articuloId: ajuste.articuloId, almacenId: ajuste.almacenId };
      const candado = await this.candado(tx, par);
      await bloquear(tx, [candado]);
      if ((await tx.ajusteInventario.findUniqueOrThrow({ where: { id } })).estado !== 'PENDIENTE') throw this.yaResuelto();
      const tipo = TIPO_POR_MOTIVO[ajuste.motivo];
      const base = { tipo, ...par, fechaOperacion: fecha, usuarioId: u.id, motivo: `${ajuste.motivo.replaceAll('_', ' ').toLowerCase()} (ajuste ${id})`, documentoTipo: 'AjusteInventario', documentoId: id };
      const movs: DatosMovimiento[] = [];
      const consumidas: Pieza[] = [];
      if (ajuste.cantidad < 0) {
        // DIFERENCIA_RECEPCION: sale del tránsito de su traslado como pérdida, al costo FIFO de su capa.
        for (const p of await consumir(tx, { ...par, cantidad: -ajuste.cantidad, capaId: ajuste.capaId ?? undefined, ordenTrasladoId: ajuste.ordenTrasladoId ?? undefined })) {
          consumidas.push(p);
          movs.push({ ...base, ubicacionId: p.capa.ubicacionId, capaId: p.capa.id, cantidad: -p.cantidad, costoUnitario: p.capa.costoUnitario });
        }
        const s = await saldo(tx, par, fecha, 0);
        if (candado.almacenId === par.almacenId && s.disponible < 0) throw new ErrorNegocio(409, 'AJUSTE_AFECTA_RESERVAS', 'La baja dejaría menos stock que lo reservado; cancela o reduce pedidos primero', { reservado: s.reservado, fisicoDespues: s.fisico });
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
      const aprobado = await tx.ajusteInventario.update({ where: { id }, data: { estado: 'APROBADO', aprobadoPorId: u.id, fechaResolucion: fecha, comentarioResolucion: comentario }, include: detalle });
      return { aprobado, par: candado, movs, consumidas };
    }, TX);
    await emitirCambio(this.eventos, [r.par], 'ajuste_aprobado');
    return { ...r.aprobado, valor: Math.round(r.movs.reduce((s, m) => s + m.cantidad * Number(m.costoUnitario), 0) * 100) / 100, ...resumenConsumo(r.consumidas) };
  }

  async rechazar(id: number, u: UsuarioSesion, comentario: string) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const ajuste = await this.pendiente(tx, id, u);
      const par = { articuloId: ajuste.articuloId, almacenId: ajuste.almacenId };
      const candado = await this.candado(tx, par);
      await bloquear(tx, [candado]);
      if ((await tx.ajusteInventario.findUniqueOrThrow({ where: { id } })).estado !== 'PENDIENTE') throw this.yaResuelto();
      // Diferencia en recepción rechazada: no hubo pérdida; la mercadería pasa del tránsito al destino y R06 la recuenta.
      if (ajuste.motivo === 'DIFERENCIA_RECEPCION') {
        const pick = await ubicacionPicking(tx, candado.almacenId, ajuste.articulo);
        const movs: DatosMovimiento[] = [];
        for (const p of await consumir(tx, { ...par, cantidad: -ajuste.cantidad, ordenTrasladoId: ajuste.ordenTrasladoId! })) {
          const nueva = await copiarCapa(tx, p.capa, { almacenId: candado.almacenId, ubicacionId: pick.id, cantidad: p.cantidad, fechaEntrada: fecha, ordenTrasladoId: ajuste.ordenTrasladoId });
          const base = { articuloId: par.articuloId, costoUnitario: p.capa.costoUnitario, fechaOperacion: fecha, usuarioId: u.id, motivo: `Diferencia rechazada (ajuste ${id}): entra al destino para recuento`, documentoTipo: 'AjusteInventario', documentoId: id };
          movs.push({ ...base, tipo: 'TRASLADO_SALIDA', almacenId: par.almacenId, ubicacionId: p.capa.ubicacionId, capaId: p.capa.id, cantidad: -p.cantidad });
          movs.push({ ...base, tipo: 'TRASLADO_ENTRADA', almacenId: candado.almacenId, ubicacionId: pick.id, capaId: nueva.id, cantidad: p.cantidad });
        }
        await registrar(tx, movs);
      }
      return tx.ajusteInventario.update({ where: { id }, data: { estado: 'RECHAZADO', aprobadoPorId: u.id, fechaResolucion: fecha, comentarioResolucion: comentario }, include: detalle });
    }, TX);
    await emitirCambio(this.eventos, [r], 'ajuste_rechazado');
    return r;
  }

  // Con antigüedad (fecha simulada) e impacto en USD: lo que costaría aplicarlo hoy.
  async listar(estado?: EstadoAjuste) {
    const fecha = await this.simulacion.fechaOperacion();
    const ajustes = await this.prisma.ajusteInventario.findMany({ where: { estado }, include: detalle, orderBy: { id: 'desc' } });
    const filas = [];
    for (const a of ajustes) filas.push({ ...a, antiguedadDias: Math.round((fecha.getTime() - a.fechaRegistro.getTime()) / 86_400_000), impacto: await valorarAjuste(this.prisma, a) });
    return filas;
  }

  async detalle(id: number) {
    const [a] = (await this.listar()).filter((x) => x.id === id);
    if (!a) throw noEncontrado(`El ajuste ${id}`);
    const movimientos = await this.prisma.movimiento.findMany({
      where: { documentoTipo: 'AjusteInventario', documentoId: id },
      include: { capa: { select: { lote: true } }, usuario: { select: { codigo: true } } },
      orderBy: { id: 'asc' },
    });
    // Alertas del ajuste (AL07), de su conteo (AL06) o de su traslado (AL09).
    const alertas = await this.prisma.alerta.findMany({
      where: {
        OR: [
          { referenciaTipo: 'AjusteInventario', referenciaId: id },
          ...(a.conteoId ? [{ referenciaTipo: 'ConteoFisico', referenciaId: a.conteoId }] : []),
          ...(a.ordenTrasladoId ? [{ referenciaTipo: 'OrdenTraslado', referenciaId: a.ordenTrasladoId }] : []),
        ],
      },
      select: { id: true, codigo: true, color: true, estado: true, mensaje: true },
      orderBy: { id: 'asc' },
    });
    return { ...a, movimientos, alertas };
  }

  // Vista previa del impacto en USD de un ajuste aún no registrado.
  async impacto(dto: ImpactoAjusteDto) {
    const almacen = await almacenPlanta(this.prisma, dto.almacen);
    const articulo = await articuloPorCodigo(this.prisma, dto.articulo);
    return valorarAjuste(this.prisma, { articuloId: articulo.id, almacenId: almacen.id, cantidad: dto.cantidad, capaId: dto.capaId });
  }

  private async pendiente(tx: Tx, id: number, u: UsuarioSesion) {
    const ajuste = await tx.ajusteInventario.findUnique({ where: { id }, include: { articulo: true } });
    if (!ajuste) throw noEncontrado(`El ajuste ${id}`);
    if (ajuste.estado !== 'PENDIENTE') throw this.yaResuelto();
    if (ajuste.registradoPorId === u.id) throw new ErrorNegocio(403, 'AUTOAPROBACION', 'Quien registra un ajuste o merma no puede aprobarlo ni rechazarlo');
    return ajuste;
  }

  // El stock en tránsito se protege con el candado del almacén destino.
  private async candado(tx: Tx, par: Par): Promise<Par> {
    const almacen = await tx.almacen.findUniqueOrThrow({ where: { id: par.almacenId }, include: { almacenDestino: true } });
    return almacen.tipo === 'TRANSITO' ? { articuloId: par.articuloId, almacenId: almacen.almacenDestino!.id } : par;
  }

  private yaResuelto() {
    return new ErrorNegocio(409, 'AJUSTE_YA_RESUELTO', 'El ajuste ya fue aprobado o rechazado y no se puede modificar');
  }
}
