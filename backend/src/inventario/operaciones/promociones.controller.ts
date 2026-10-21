import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles, TODOS, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { AprobarPromocionDto, FiltroPromocionesDto, PromocionDto } from './promociones.dto.js';
import { PromocionesService } from './promociones.service.js';

@ApiTags('Promociones')
@Controller('promociones')
export class PromocionesController {
  constructor(private readonly servicio: PromocionesService) {}

  /** Promociones por estado, con uso del tope y cobertura. R01 las ve para ofrecer bonificaciones (no tienen costos). */
  @Get()
  @Roles(...TODOS)
  listar(@Query() q: FiltroPromocionesDto) {
    return this.servicio.listar(q.estado);
  }

  /** Propone una promoción (R02): queda PROPUESTA. */
  @Post()
  @Roles('R02')
  proponer(@Body() dto: PromocionDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.proponer(dto, u);
  }

  /** Aprueba la promoción con la referencia del correo del Gerente de Logística y Ventas (R07) → ACTIVA. */
  @Post(':id/aprobar')
  @HttpCode(200)
  @Roles('R07')
  aprobar(@Param('id', ParseIntPipe) id: number, @Body() dto: AprobarPromocionDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.aprobar(id, dto, u);
  }

  /** Cierra la promoción (R07) → FINALIZADA. */
  @Post(':id/cerrar')
  @HttpCode(200)
  @Roles('R07')
  cerrar(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.cerrar(id);
  }
}
