import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';
import { clasificarAbc } from './calculos/formulas.js';
import { obtenerStock, resolverAlmacen } from './stock.js';

@Controller()
export class InventarioController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  @Get('stock')
  async stock(@Query('almacenId') almacenParam?: string) {
    if (!almacenParam) throw new BadRequestException('Falta almacenId');
    const almacen = await resolverAlmacen(this.prisma, almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    return { almacen: almacen.codigo, fechaOperacion: fecha, articulos: await obtenerStock(this.prisma, almacen.id, fecha) };
  }

  // Pareto con la demanda de La Paz (sección 4): venta diaria en USD = precio × d.
  @Get('abc')
  async abc() {
    const parametros = await this.prisma.parametroArticuloAlmacen.findMany({
      where: { almacen: { codigo: 'CD-LP-01' } },
      include: { articulo: true },
    });
    return clasificarAbc(
      parametros.map((p) => ({ codigo: p.articulo.codigo, descripcion: p.articulo.descripcion, precio: Number(p.articulo.precio), demandaDiaria: p.demandaDiaria })),
    );
  }

  @Get('fiestas')
  fiestas() {
    return this.prisma.fiesta.findMany({ orderBy: { fechaInicio: 'asc' } });
  }
}
