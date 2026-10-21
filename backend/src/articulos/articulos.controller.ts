import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { LECTURA, Roles, TODOS, UsuarioActual, type UsuarioSesion } from '../usuarios/autorizacion.js';
import { AlmacenArticuloDto, FiltroCapasDto, KardexDto, SerieDto } from './articulos.dto.js';
import { ArticulosService } from './articulos.service.js';

@ApiTags('Artículos')
@Roles(...LECTURA)
@Controller('articulos')
export class ArticulosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicio: ArticulosService,
  ) {}

  /** Artículos con parámetros por almacén y clase ABC. */
  @Get()
  listar() {
    return this.prisma.articulo.findMany({
      include: { parametros: { include: { almacen: { select: { id: true, codigo: true } } }, orderBy: { almacenId: 'asc' } } },
      orderBy: { codigo: 'asc' },
    });
  }

  /** Tabla de artículos con estado por almacén, vendible total, cobertura mínima y alertas. R01: solo disponible/agotado. */
  @Get('estado')
  @Roles(...TODOS)
  estado(@UsuarioActual() u: UsuarioSesion) {
    return this.servicio.estado(u);
  }

  /** Ficha: estados del stock, parámetros, costos FIFO y stock por función por almacén. R01: solo disponible/vendible. */
  @Get(':codigo/resumen')
  @Roles(...TODOS)
  resumen(@Param('codigo') codigo: string, @Query() q: AlmacenArticuloDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.resumen(codigo, q.almacenId, u);
  }

  /** Serie diaria del stock físico de los últimos N días, con SS, ROP y Máx. */
  @Get(':codigo/serie')
  serie(@Param('codigo') codigo: string, @Query() q: SerieDto) {
    return this.servicio.serie(codigo, q.almacenId, q.dias);
  }

  /** Capas FIFO con saldo, en orden de consumo: próxima en salir, despachable y valor. */
  @Get(':codigo/capas')
  capas(@Param('codigo') codigo: string) {
    return this.servicio.capas(codigo);
  }

  /** Kardex valorado con saldo acumulado (cantidad y valor), filtros por tipo y fechas, y paginación (más reciente primero). */
  @Get(':codigo/kardex')
  kardex(@Param('codigo') codigo: string, @Query() q: KardexDto) {
    return this.servicio.kardex(codigo, q);
  }
}

@ApiTags('Artículos')
@Roles(...LECTURA)
@Controller('capas')
export class CapasController {
  constructor(private readonly servicio: ArticulosService) {}

  /** Capas con saldo filtradas por almacén, artículo y estado (cuarentena, ajustes, aprobaciones). */
  @Get()
  listar(@Query() q: FiltroCapasDto) {
    return this.servicio.capas(q.articulo, q);
  }
}
