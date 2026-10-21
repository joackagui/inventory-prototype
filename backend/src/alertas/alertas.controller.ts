import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorNegocio } from '../comun/errores.js';
import { LECTURA, Roles, UsuarioActual, type UsuarioSesion } from '../usuarios/autorizacion.js';
import { AlmacenAlertasDto, AtenderDto, FiltroAlertasDto, UmbralDto } from './alertas.dto.js';
import { AlertasService } from './alertas.service.js';

@ApiTags('Alertas')
@Controller()
export class AlertasController {
  constructor(private readonly servicio: AlertasService) {}

  /** Alertas con filtros (estado, color, código, almacén, artículo, rol responsable) y paginación. R01 no ve alertas. */
  @Get('alertas')
  @Roles(...LECTURA)
  listar(@Query() f: FiltroAlertasDto) {
    return this.servicio.listar(f);
  }

  /** Contadores de alertas vigentes por color, código y almacén, sin atender y escaladas. */
  @Get('alertas/resumen')
  @Roles(...LECTURA)
  resumen(@Query() q: AlmacenAlertasDto) {
    return this.servicio.resumen(q.almacenId);
  }

  /** Umbrales vigentes de las alertas. */
  @Get('alertas/umbrales')
  @Roles(...LECTURA)
  umbrales() {
    return this.servicio.umbrales();
  }

  /** Cambia un umbral (R07). Valida que el amarillo se dispare antes que el rojo; queda en la bitácora y reevalúa. */
  @Put('alertas/umbrales/:clave')
  @Roles('R07')
  cambiarUmbral(@Param('clave') clave: string, @Body() dto: UmbralDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.cambiarUmbral(clave, dto.valor, u);
  }

  /** Evaluación completa manual (R07, R09). */
  @Post('alertas/evaluar')
  @HttpCode(200)
  @Roles('R07', 'R09')
  evaluar() {
    return this.servicio.evaluar();
  }

  /** Alerta con su historial (cambios de color, atención, escalamientos). */
  @Get('alertas/:id')
  @Roles(...LECTURA)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.detalle(id);
  }

  /** Atiende la alerta: rol responsable (R06 solo en su almacén) o R07. La alerta se resuelve sola cuando desaparece la condición. */
  @Post('alertas/:id/atender')
  @HttpCode(200)
  @Roles('R02', 'R03', 'R06', 'R07', 'R09')
  atender(@Param('id', ParseIntPipe) id: number, @Body() dto: AtenderDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.atender(id, dto, u);
  }

  /** Semáforo por artículo de un almacén: estados del stock, color global y alertas activas. */
  @Get('semaforo')
  @Roles(...LECTURA)
  semaforo(@Query() q: AlmacenAlertasDto) {
    if (!q.almacenId) throw new ErrorNegocio(400, 'FALTA_ALMACEN', 'Falta almacenId');
    return this.servicio.semaforo(q.almacenId);
  }
}
