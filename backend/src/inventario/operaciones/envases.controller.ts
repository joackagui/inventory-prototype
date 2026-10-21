import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LECTURA, OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { EnvasesService } from './envases.service.js';
import { EnvaseDto, FiltroEnvasesDto } from './envases.dto.js';

@ApiTags('Envases')
@Controller('envases')
export class EnvasesController {
  constructor(private readonly servicio: EnvasesService) {}

  /** Registra envases entregados a un cliente (R06). */
  @Post('entrega')
  @Roles(...OPERAN)
  entrega(@Body() dto: EnvaseDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.registrar('entrega', dto, u);
  }

  /** Registra envases devueltos (R06). No se puede devolver más de lo entregado. */
  @Post('devolucion')
  @Roles(...OPERAN)
  devolucion(@Body() dto: EnvaseDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.registrar('devolucion', dto, u);
  }

  /** Saldos de envases por cliente con antigüedad en días. */
  @Get('saldos')
  @Roles(...LECTURA)
  saldos(@Query() q: FiltroEnvasesDto) {
    return this.servicio.saldos(q);
  }

  /** Detalle de un saldo de envases con los demás saldos del cliente y sus movimientos. */
  @Get('saldos/:id')
  @Roles(...LECTURA)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.detalle(id);
  }
}
