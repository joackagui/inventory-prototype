import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorNegocio } from '../../comun/errores.js';
import { LECTURA, OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { TrasladosService } from './traslados.service.js';
import { AlmacenQueryDto, FiltroTrasladosDto, RecepcionTrasladoDto, TrasladoDto } from './traslados.dto.js';

@ApiTags('Traslados')
@Controller('traslados')
export class TrasladosController {
  constructor(private readonly servicio: TrasladosService) {}

  /** Traslado propuesto por artículo (Máx − posición cuando posición ≤ ROP) y almacén origen sugerido. */
  @Get('propuesta')
  @Roles(...LECTURA)
  propuesta(@Query() q: AlmacenQueryDto) {
    if (!q.almacenId) throw new ErrorNegocio(400, 'FALTA_ALMACEN', 'Falta almacenId');
    return this.servicio.propuesta(q.almacenId);
  }

  /** Órdenes de traslado. */
  @Get()
  @Roles(...LECTURA)
  listar(@Query() q: FiltroTrasladosDto) {
    return this.servicio.listar(q.estado);
  }

  /** Emite una orden de traslado entre plantas (R07). */
  @Post()
  @Roles('R07')
  crear(@Body() dto: TrasladoDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  /** Despacha la orden desde el origen hacia el tránsito (R06 del origen). */
  @Post(':id/despachar')
  @HttpCode(200)
  @Roles(...OPERAN)
  despachar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.despachar(id, u);
  }

  /** Confirma la recepción en el destino (R06 del destino), registrando diferencias. */
  @Post(':id/recibir')
  @HttpCode(200)
  @Roles(...OPERAN)
  recibir(@Param('id', ParseIntPipe) id: number, @Body() dto: RecepcionTrasladoDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.recibir(id, dto, u);
  }
}
