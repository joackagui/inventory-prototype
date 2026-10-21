import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { RecepcionService } from './recepcion.service.js';
import { RecepcionDto } from './recepcion.dto.js';

@ApiTags('Operaciones')
@Controller('operaciones')
export class RecepcionController {
  constructor(private readonly servicio: RecepcionService) {}

  /** Recepción de producción de planta: crea capa FIFO (vencimiento = elaboración + vida útil) y movimiento ENTRADA. */
  @Post('recepcion')
  @Roles(...OPERAN)
  registrar(@Body() dto: RecepcionDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.registrar(dto, u);
  }
}
