import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../comun/errores.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EVENTO_CAMBIO, EVENTO_EVALUAR, type Par } from '../inventario/motor.js';
import { obtenerStock, resolverAlmacen } from '../inventario/stock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';
import type { UsuarioSesion } from '../usuarios/autorizacion.js';
import type { AtenderDto, FiltroAlertasDto } from './alertas.dto.js';
import { evaluarAlertas } from './evaluacion.js';
import { combinarUmbrales, validarUmbral } from './evaluadores.js';

const GRAVEDAD = { ROJO: 3, AMARILLO: 2, AZUL: 1 } as const;
const VIGENTES = { in: ['ABIERTA', 'ATENDIDA'] as ('ABIERTA' | 'ATENDIDA')[] };
const SITUACION = { ABIERTA: 'abierta', ATENDIDA: 'atendida, condición vigente', RESUELTA: 'resuelta' } as const;
const conRelaciones = { almacen: { select: { codigo: true } }, articulo: { select: { codigo: true } }, atendidaPor: { select: { codigo: true } } } as const;

@Injectable()
export class AlertasService implements OnApplicationBootstrap {
  private readonly log = new Logger('Alertas');

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  async onApplicationBootstrap() {
    await this.evaluar().catch((e: Error) => this.log.warn(`No se pudo evaluar al arrancar: ${e.message}`));
  }

  evaluar(alcance?: { pares?: Par[] }) {
    return evaluarAlertas(this.prisma, alcance);
  }

  // Tras cada operación: solo el artículo y almacén afectados (más las alertas de documentos).
  @OnEvent(EVENTO_CAMBIO)
  async alCambio(par: Par) {
    await this.evaluar({ pares: [par] }).catch((e: Error) => this.log.error(`Evaluación tras operación: ${e.message}`));
  }

  // Cambio de fecha simulada, eventos de integración, umbrales: evaluación completa (devuelve qué cambió).
  @OnEvent(EVENTO_EVALUAR)
  async alEvaluarTodo() {
    return this.evaluar().catch((e: Error) => {
      this.log.error(`Evaluación completa: ${e.message}`);
      return null;
    });
  }

  async listar(f: FiltroAlertasDto) {
    const where: Prisma.AlertaWhereInput = {
      estado: f.estado ?? (f.orden === 'gravedad' ? VIGENTES : undefined),
      color: f.color,
      codigo: f.codigo,
      almacen: f.almacen ? { codigo: f.almacen } : undefined,
      articulo: f.articulo ? { codigo: f.articulo } : undefined,
      rolesResponsables: f.rol ? { has: f.rol } : undefined,
    };
    const fecha = await this.simulacion.fechaOperacion();
    const todas = await this.prisma.alerta.findMany({ where, include: conRelaciones, orderBy: [{ codigo: 'asc' }, { id: 'asc' }] });
    if (f.orden === 'gravedad') {
      todas.sort(
        (a, b) =>
          GRAVEDAD[b.color] - GRAVEDAD[a.color] ||
          Number(a.estado !== 'ABIERTA') - Number(b.estado !== 'ABIERTA') ||
          b.nivelEscalamiento - a.nivelEscalamiento ||
          a.fechaColor.getTime() - b.fechaColor.getTime() ||
          a.id - b.id,
      );
    }
    const datos = todas.slice((f.pagina - 1) * f.tamano, f.pagina * f.tamano);
    return {
      total: todas.length,
      pagina: f.pagina,
      tamano: f.tamano,
      datos: datos.map((a) => ({ ...a, situacion: SITUACION[a.estado], antiguedadDias: Math.round((fecha.getTime() - a.fechaOperacion.getTime()) / 86_400_000) })),
    };
  }

  async detalle(id: number) {
    const a = await this.prisma.alerta.findUnique({
      where: { id },
      include: { ...conRelaciones, historial: { include: { usuario: { select: { codigo: true } } }, orderBy: { id: 'asc' } } },
    });
    if (!a) throw noEncontrado(`La alerta ${id}`);
    return { ...a, situacion: SITUACION[a.estado] };
  }

  async resumen(almacenParam?: string) {
    const almacen = almacenParam ? await resolverAlmacen(this.prisma, almacenParam) : null;
    const vigentes = await this.prisma.alerta.findMany({ where: { estado: VIGENTES, almacenId: almacen?.id }, include: { almacen: { select: { codigo: true } } } });
    const contar = (clave: (a: (typeof vigentes)[number]) => string) => vigentes.reduce<Record<string, number>>((acc, a) => ({ ...acc, [clave(a)]: (acc[clave(a)] ?? 0) + 1 }), {});
    return {
      almacen: almacen?.codigo ?? null,
      fechaOperacion: await this.simulacion.fechaSimulada(),
      total: vigentes.length,
      porColor: { ROJO: 0, AMARILLO: 0, AZUL: 0, ...contar((a) => a.color) },
      porCodigo: contar((a) => a.codigo),
      porAlmacen: contar((a) => a.almacen?.codigo ?? 'SISTEMA'),
      sinAtender: vigentes.filter((a) => a.estado === 'ABIERTA').length,
      rojasSinAtender: vigentes.filter((a) => a.estado === 'ABIERTA' && a.color === 'ROJO').length,
      escaladas: vigentes.filter((a) => a.nivelEscalamiento > 0).length,
    };
  }

  // Atiende el rol responsable (R06 solo en su almacén) o R07. No cierra la condición: se resuelve cuando desaparece.
  async atender(id: number, dto: AtenderDto, u: UsuarioSesion) {
    const a = await this.prisma.alerta.findUnique({ where: { id } });
    if (!a) throw noEncontrado(`La alerta ${id}`);
    if (a.estado !== 'ABIERTA') throw new ErrorNegocio(409, 'ALERTA_NO_ABIERTA', `La alerta ${id} ya está ${a.estado.toLowerCase()}`);
    const responsable = u.rolCodigo === 'R07' || (a.rolesResponsables.includes(u.rolCodigo) && (u.rolCodigo !== 'R06' || u.almacenId === a.almacenId));
    if (!responsable) {
      throw new ErrorNegocio(403, 'NO_RESPONSABLE', `La alerta ${a.codigo} la atiende ${a.rolesResponsables.join(' o ')}${a.rolesResponsables.includes('R06') ? ' (de su almacén)' : ''} o R07`);
    }
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.alerta.updateMany({
      where: { id, estado: 'ABIERTA' },
      data: { estado: 'ATENDIDA', atendidaPorId: u.id, atendidaEn: new Date(), fechaAtencion: fecha, resultado: dto.resultado, comentario: dto.comentario },
    });
    if (!r.count) throw new ErrorNegocio(409, 'ALERTA_NO_ABIERTA', `La alerta ${id} ya fue atendida`);
    await this.prisma.historialAlerta.create({ data: { alertaId: id, tipo: 'ATENDIDA', usuarioId: u.id, detalle: dto.resultado, fechaOperacion: fecha } });
    return this.detalle(id);
  }

  // Semáforo por artículo: color global = la alerta vigente más grave (rojo > amarillo > azul > verde).
  async semaforo(almacenParam: string) {
    const almacen = await resolverAlmacen(this.prisma, almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const stock = await obtenerStock(this.prisma, almacen.id, fecha, await this.simulacion.diasMinimosDespacho());
    const alertas = await this.prisma.alerta.findMany({ where: { estado: VIGENTES, almacenId: almacen.id } });
    return {
      almacen: almacen.codigo,
      fechaOperacion: fecha,
      articulos: stock.map((s) => {
        const propias = alertas.filter((a) => a.articuloId === s.articuloId);
        const peor = propias.reduce<keyof typeof GRAVEDAD | null>((m, a) => (!m || GRAVEDAD[a.color] > GRAVEDAD[m] ? a.color : m), null);
        return {
          codigo: s.codigo,
          descripcion: s.descripcion,
          claseAbc: s.claseAbc,
          disponible: s.disponible,
          vendible: s.vendible,
          reservado: s.reservado,
          enTransito: s.enTransito,
          posicion: s.posicion,
          coberturaDias: s.coberturaDias,
          rop: s.rop,
          stockSeguridad: s.stockSeguridad,
          stockMaximo: s.stockMaximo,
          vidaRestanteDias: s.vidaRestanteDias,
          trasladoPropuesto: s.trasladoPropuesto,
          color: peor ?? 'VERDE',
          alertas: [...new Set(propias.map((a) => a.codigo))].sort(),
        };
      }),
    };
  }

  async umbrales() {
    return combinarUmbrales(await this.simulacion.valor<Record<string, object> | null>('umbralesAlertas', null));
  }

  async cambiarUmbral(clave: string, valor: Record<string, unknown>, u: UsuarioSesion) {
    const error = validarUmbral(clave, valor);
    if (error) throw new ErrorNegocio(400, 'UMBRAL_INVALIDO', error);
    const actuales = await this.umbrales();
    const nuevos = { ...actuales, [clave]: { ...(actuales as Record<string, object>)[clave], ...valor } };
    await this.simulacion.guardar('umbralesAlertas', nuevos as Prisma.InputJsonObject, u.id, 'Umbrales editables de las alertas AL01–AL16 (sección 8)');
    await this.evaluar();
    return nuevos;
  }
}
