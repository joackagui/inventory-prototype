import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { TIPOS_FISICOS, vidaRestanteDias } from '../inventario/calculos/formulas.js';
import { resolverAlmacen } from '../inventario/stock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';

@Controller('articulos')
export class ArticulosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  @Get()
  listar() {
    return this.prisma.articulo.findMany({
      include: { parametros: { include: { almacen: { select: { id: true, codigo: true } } }, orderBy: { almacenId: 'asc' } } },
      orderBy: { codigo: 'asc' },
    });
  }

  // Capas FIFO con saldo, en orden de consumo.
  @Get(':codigo/capas')
  async capas(@Param('codigo') codigo: string) {
    const fecha = await this.simulacion.fechaOperacion();
    const capas = await this.prisma.capaFifo.findMany({
      where: { articulo: { codigo }, cantidadRestante: { gt: 0 } },
      include: { almacen: { select: { codigo: true } }, ubicacion: { select: { codigo: true } } },
      orderBy: [{ almacenId: 'asc' }, { fechaEntrada: 'asc' }, { id: 'asc' }],
    });
    return capas.map((c) => ({ ...c, costoUnitario: Number(c.costoUnitario), vidaRestanteDias: vidaRestanteDias(c.fechaVencimiento, fecha) }));
  }

  // Kardex valorado: saldo acumulado solo con los movimientos que cambian el stock físico.
  @Get(':codigo/kardex')
  async kardex(@Param('codigo') codigo: string, @Query('almacenId') almacenParam?: string) {
    if (!almacenParam) throw new BadRequestException('Falta almacenId');
    const almacen = await resolverAlmacen(this.prisma, almacenParam);
    const movimientos = await this.prisma.movimiento.findMany({
      where: { articulo: { codigo }, almacenId: almacen.id },
      include: { usuario: { select: { codigo: true } }, ubicacion: { select: { codigo: true } }, capa: { select: { lote: true } } },
      orderBy: [{ fechaOperacion: 'asc' }, { id: 'asc' }],
    });
    const fisicos: readonly string[] = TIPOS_FISICOS;
    let saldo = 0;
    let saldoValor = 0;
    return movimientos.map((m) => {
      if (fisicos.includes(m.tipo)) {
        saldo += m.cantidad;
        saldoValor = Math.round((saldoValor + Number(m.valor)) * 100) / 100;
      }
      return {
        id: m.id,
        fechaOperacion: m.fechaOperacion,
        tipo: m.tipo,
        motivo: m.motivo,
        ubicacion: m.ubicacion.codigo,
        lote: m.capa?.lote ?? null,
        usuario: m.usuario.codigo,
        cantidad: m.cantidad,
        costoUnitario: Number(m.costoUnitario),
        valor: Number(m.valor),
        saldo,
        saldoValor,
      };
    });
  }
}
