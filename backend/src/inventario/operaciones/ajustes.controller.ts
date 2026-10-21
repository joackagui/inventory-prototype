import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LECTURA, OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { AjustesService } from './ajustes.service.js';
import { AjusteDto, FiltroAjustesDto } from './ajustes.dto.js';

@ApiTags('Ajustes y mermas')
@Controller('ajustes')
export class AjustesController {
  constructor(private readonly servicio: AjustesService) {}

  /** Registra un ajuste o merma (R06): queda PENDIENTE de aprobación. */
  @Post()
  @Roles(...OPERAN)
  crear(@Body() dto: AjusteDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  /** Ajustes por estado. */
  @Get()
  @Roles(...LECTURA)
  listar(@Query() q: FiltroAjustesDto) {
    return this.servicio.listar(q.estado);
  }

  /** Aprueba y aplica el ajuste (R07, distinto de quien lo registró). */
  @Post(':id/aprobar')
  @HttpCode(200)
  @Roles('R07')
  aprobar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.aprobar(id, u);
  }

  /** Rechaza el ajuste (R07, distinto de quien lo registró). */
  @Post(':id/rechazar')
  @HttpCode(200)
  @Roles('R07')
  rechazar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.rechazar(id, u);
  }
}
