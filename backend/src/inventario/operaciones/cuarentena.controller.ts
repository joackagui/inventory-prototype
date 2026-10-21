import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { CuarentenaService } from './cuarentena.service.js';
import { CuarentenaDto } from './cuarentena.dto.js';

@ApiTags('Cuarentena')
@Controller('cuarentena')
export class CuarentenaController {
  constructor(private readonly servicio: CuarentenaService) {}

  /** Mueve cantidad de una capa a CUAR-01 (R06). No se vende ni se despacha. */
  @Post()
  @Roles(...OPERAN)
  mover(@Body() dto: CuarentenaDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.mover(dto, u);
  }

  /** Libera la capa de cuarentena (R07). Para mermarla, registrar un ajuste con su capaId. */
  @Post(':capaId/liberar')
  @HttpCode(200)
  @Roles('R07')
  liberar(@Param('capaId', ParseIntPipe) capaId: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.liberar(capaId, u);
  }
}
