import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';
import { LECTURA, Roles, TODOS, UsuarioActual, type UsuarioSesion } from '../usuarios/autorizacion.js';
import { combinarUmbrales } from '../alertas/evaluadores.js';
import { clasificarAbc, NIVEL_SERVICIO } from './calculos/formulas.js';
import { verificarIntegridad } from './integridad.js';
import { obtenerStock, resolverAlmacen } from './stock.js';
import { FiltroMovimientosDto } from './inventario.dto.js';

@ApiTags('Inventario')
@Controller()
export class InventarioController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  /** Estados del stock por artículo en un almacén. El preventista (R01) solo ve disponible/agotado, sin costos. */
  @Get('stock')
  @Roles(...TODOS)
  async stock(@Query('almacenId') almacenParam: string | undefined, @UsuarioActual() u: UsuarioSesion) {
    if (!almacenParam) throw new BadRequestException('Falta almacenId');
    const almacen = await resolverAlmacen(this.prisma, almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const articulos = await obtenerStock(this.prisma, almacen.id, fecha, await this.simulacion.diasMinimosDespacho());
    if (u.rolCodigo === 'R01') {
      return {
        almacen: almacen.codigo,
        fechaOperacion: fecha,
        articulos: articulos.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion, disponible: Math.max(0, a.vendible), estado: a.vendible > 0 ? 'DISPONIBLE' : 'AGOTADO' })),
      };
    }
    return { almacen: almacen.codigo, fechaOperacion: fecha, articulos };
  }

  /** Análisis ABC / Pareto con la demanda de La Paz (venta diaria en USD = precio × d). */
  @Get('abc')
  @Roles(...LECTURA)
  async abc() {
    const parametros = await this.prisma.parametroArticuloAlmacen.findMany({
      where: { almacen: { codigo: 'CD-LP-01' } },
      include: { articulo: true },
    });
    const frecuencia = combinarUmbrales(await this.simulacion.valor('umbralesAlertas', null)).AL05.frecuenciaDias;
    // Clase calculada hoy frente a la guardada (vista previa de «Recalcular»), con su nivel de servicio y frecuencia de conteo.
    return clasificarAbc(
      parametros.map((p) => ({ codigo: p.articulo.codigo, descripcion: p.articulo.descripcion, precio: Number(p.articulo.precio), demandaDiaria: p.demandaDiaria })),
    ).map((a) => {
      const { nivelServicio, z } = NIVEL_SERVICIO[a.clase];
      return { ...a, claseActual: parametros.find((p) => p.articulo.codigo === a.codigo)!.claseAbc, nivelServicio, z, frecuenciaConteoDias: frecuencia[a.clase] };
    });
  }

  /** Calendario de fiestas. */
  @Get('fiestas')
  @Roles(...TODOS)
  fiestas() {
    return this.prisma.fiesta.findMany({ orderBy: { fechaInicio: 'asc' } });
  }

  /** Libro mayor de movimientos, filtrable y paginado. */
  @Get('movimientos')
  @Roles(...LECTURA)
  async movimientos(@Query() f: FiltroMovimientosDto) {
    const where = {
      almacen: f.almacen ? { codigo: f.almacen } : undefined,
      articulo: f.articulo ? { codigo: f.articulo } : undefined,
      tipo: f.tipo,
      fechaOperacion: f.desde || f.hasta ? { gte: f.desde ? new Date(f.desde) : undefined, lte: f.hasta ? new Date(f.hasta) : undefined } : undefined,
    };
    const [total, datos] = await Promise.all([
      this.prisma.movimiento.count({ where }),
      this.prisma.movimiento.findMany({
        where,
        include: { articulo: { select: { codigo: true } }, almacen: { select: { codigo: true } }, ubicacion: { select: { codigo: true } }, usuario: { select: { codigo: true } }, capa: { select: { lote: true } } },
        orderBy: [{ fechaOperacion: 'desc' }, { id: 'desc' }],
        skip: (f.pagina - 1) * f.tamano,
        take: f.tamano,
      }),
    ]);
    return { total, pagina: f.pagina, tamano: f.tamano, datos: datos.map((m) => ({ ...m, costoUnitario: Number(m.costoUnitario), valor: Number(m.valor) })) };
  }

  /** Verificación de integridad: capas vs. movimientos vs. estados del stock (R07, R09). */
  @Get('integridad')
  @Roles('R07', 'R09')
  async integridad() {
    return verificarIntegridad(this.prisma, await this.simulacion.fechaOperacion());
  }

  /** Bitácora de cambios (R07, R09). */
  @Get('bitacora')
  @Roles('R07', 'R09')
  bitacora() {
    return this.prisma.registroCambio.findMany({ include: { usuario: { select: { codigo: true } } }, orderBy: { id: 'desc' }, take: 200 });
  }
}
