import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { RecepcionService } from './recepcion.service.js';
import { PreviaRecepcionDto, RecepcionDto } from './recepcion.dto.js';

@ApiTags('Operaciones')
@Controller('operaciones')
export class RecepcionController {
  constructor(private readonly servicio: RecepcionService) {}

  /** Vista previa de una recepción: ubicación sugerida, vencimiento y aviso de costo atípico (AL13). */
  @Get('recepcion/previa')
  @Roles(...OPERAN)
  previa(@Query() q: PreviaRecepcionDto) {
    return this.servicio.previa(q);
  }

  /** Recepción de producción de planta: crea capa FIFO (vencimiento = elaboración + vida útil) y movimiento ENTRADA. */
  @Post('recepcion')
  @Roles(...OPERAN)
  registrar(@Body() dto: RecepcionDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.registrar(dto, u);
  }
}
