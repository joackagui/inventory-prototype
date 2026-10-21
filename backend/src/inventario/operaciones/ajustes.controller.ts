import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LECTURA, OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { AjustesService } from './ajustes.service.js';
import { AjusteDto, FiltroAjustesDto, ImpactoAjusteDto, RechazarAjusteDto, ResolverAjusteDto } from './ajustes.dto.js';

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

  /** Impacto en USD de un ajuste antes de registrarlo (baja: capas FIFO o la indicada; alta: costo de la última capa). */
  @Get('impacto')
  @Roles(...LECTURA)
  impacto(@Query() q: ImpactoAjusteDto) {
    return this.servicio.impacto(q);
  }

  /** Detalle del ajuste: capa, conteo o traslado de origen, impacto, movimientos y alertas relacionadas. */
  @Get(':id')
  @Roles(...LECTURA)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.detalle(id);
  }

  /** Aprueba y aplica el ajuste (R07, distinto de quien lo registró). */
  @Post(':id/aprobar')
  @HttpCode(200)
  @Roles('R07')
  aprobar(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolverAjusteDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.aprobar(id, u, dto.comentario);
  }

  /** Rechaza el ajuste (R07, distinto de quien lo registró). */
  @Post(':id/rechazar')
  @HttpCode(200)
  @Roles('R07')
  rechazar(@Param('id', ParseIntPipe) id: number, @Body() dto: RechazarAjusteDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.rechazar(id, u, dto.comentario);
  }
}
