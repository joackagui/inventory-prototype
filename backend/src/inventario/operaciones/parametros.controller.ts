import { Body, Controller, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { ParametrosService } from './parametros.service.js';
import { ParametrosDto } from './parametros.dto.js';

@ApiTags('Parámetros')
@Controller()
export class ParametrosController {
  constructor(private readonly servicio: ParametrosService) {}

  /** Edita d, σd, L, clase o nivel de servicio y recalcula Z, SS, ROP, Q y Máx (R07). Queda en la bitácora. */
  @Put('parametros/:articulo/:almacen')
  @Roles('R07')
  actualizar(@Param('articulo') articulo: string, @Param('almacen') almacen: string, @Body() dto: ParametrosDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.actualizar(articulo, almacen, dto, u);
  }

  /** Recalcula la clase ABC de todos los artículos (R07). */
  @Post('abc/recalcular')
  @HttpCode(200)
  @Roles('R07')
  recalcularAbc(@UsuarioActual() u: UsuarioSesion) {
    return this.servicio.recalcularAbc(u);
  }
}
