import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { noEncontrado } from '../../comun/errores.js';
import type { ParametroArticuloAlmacen, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SimulacionService } from '../../simulacion/simulacion.service.js';
import type { UsuarioSesion } from '../../usuarios/autorizacion.js';
import { calcularParametros, clasificarAbc, type ClaseAbc, NIVEL_SERVICIO } from '../calculos/formulas.js';
import { emitirCambio, type Tx } from '../motor.js';
import { TX } from './comun.js';
import type { ParametrosDto } from './parametros.dto.js';

const CAMPOS = ['demandaDiaria', 'desviacionDemanda', 'leadTimeDias', 'claseAbc', 'nivelServicio', 'z', 'diasRevision', 'stockSeguridad', 'rop', 'loteTraslado', 'stockMaximo'] as const;
const resumen = (p: ParametroArticuloAlmacen) => Object.fromEntries(CAMPOS.map((c) => [c, p[c]])) as Prisma.InputJsonObject;

@Injectable()
export class ParametrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Cambia las entradas (d, σd, L, clase, nivel de servicio) y recalcula Z, SS, ROP, Q y Máx con las funciones puras.
  async actualizar(articulo: string, almacen: string, dto: ParametrosDto, u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.parametroArticuloAlmacen.findFirst({ where: { articulo: { codigo: articulo }, almacen: { codigo: almacen } } });
      if (!actual) throw noEncontrado(`El parámetro de ${articulo} en ${almacen}`);
      const clase = dto.claseAbc ?? actual.claseAbc;
      // Si cambia la clase sin indicar nivel de servicio, se usa el nivel estándar de la nueva clase.
      const nivel = dto.nivelServicio ?? (dto.claseAbc ? NIVEL_SERVICIO[clase].nivelServicio : actual.nivelServicio);
      return this.guardar(tx, actual, { demandaDiaria: dto.demandaDiaria, desviacionDemanda: dto.desviacionDemanda, leadTimeDias: dto.leadTimeDias, claseAbc: clase, nivelServicio: nivel }, u, fecha);
    }, TX);
    await emitirCambio(this.eventos, [r], 'parametros');
    return r;
  }

  // Recalcula la clase ABC de todos los artículos con la demanda de La Paz y actualiza los parámetros de los 3 almacenes.
  async recalcularAbc(u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const r = await this.prisma.$transaction(async (tx) => {
      const base = await tx.parametroArticuloAlmacen.findMany({ where: { almacen: { codigo: 'CD-LP-01' } }, include: { articulo: true } });
      const clasificacion = clasificarAbc(base.map((p) => ({ codigo: p.articulo.codigo, precio: Number(p.articulo.precio), demandaDiaria: p.demandaDiaria })));
      const clases = new Map(clasificacion.map((c) => [c.codigo, c.clase]));
      const todos = await tx.parametroArticuloAlmacen.findMany({ include: { articulo: true, almacen: true } });
      const cambios = [];
      for (const p of todos) {
        const clase = clases.get(p.articulo.codigo)!;
        if (clase === p.claseAbc) continue;
        await this.guardar(tx, p, { claseAbc: clase, nivelServicio: NIVEL_SERVICIO[clase].nivelServicio }, u, fecha);
        cambios.push({ articulo: p.articulo.codigo, almacen: p.almacen.codigo, de: p.claseAbc, a: clase });
      }
      return { clasificacion, cambios, pares: todos.map((p) => ({ articuloId: p.articuloId, almacenId: p.almacenId })) };
    }, TX);
    await emitirCambio(this.eventos, r.pares, 'abc');
    return { clasificacion: r.clasificacion, cambios: r.cambios };
  }

  private async guardar(
    tx: Tx,
    actual: ParametroArticuloAlmacen,
    e: { demandaDiaria?: number; desviacionDemanda?: number; leadTimeDias?: number; claseAbc: ClaseAbc; nivelServicio: number },
    u: UsuarioSesion,
    fecha: Date,
  ) {
    const d = e.demandaDiaria ?? actual.demandaDiaria;
    const sigma = e.desviacionDemanda ?? actual.desviacionDemanda;
    const L = e.leadTimeDias ?? actual.leadTimeDias;
    const calculados = calcularParametros(d, sigma, L, e.claseAbc, e.nivelServicio);
    const nuevo = await tx.parametroArticuloAlmacen.update({
      where: { id: actual.id },
      data: { demandaDiaria: d, desviacionDemanda: sigma, leadTimeDias: L, claseAbc: e.claseAbc, ...calculados },
    });
    await tx.registroCambio.create({
      data: { usuarioId: u.id, entidad: 'ParametroArticuloAlmacen', entidadId: String(actual.id), campo: 'parametros', valorAnterior: resumen(actual), valorNuevo: resumen(nuevo), fechaOperacion: fecha },
    });
    return nuevo;
  }
}
