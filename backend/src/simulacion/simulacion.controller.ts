import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorNegocio } from '../comun/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LECTURA, Roles, TODOS, UsuarioActual, type UsuarioSesion } from '../usuarios/autorizacion.js';
import { FECHA_INICIAL, SimulacionService } from './simulacion.service.js';
import { AvanzarDto, FechaDto, ValorConfiguracionDto } from './simulacion.dto.js';

@ApiTags('Simulación')
@Controller('simulacion')
export class SimulacionController {
  constructor(private readonly simulacion: SimulacionService) {}

  /** Fecha de operación simulada actual. */
  @Get('fecha')
  @Roles(...TODOS)
  async fecha() {
    return { fechaSimulada: await this.simulacion.fechaSimulada() };
  }

  /** Fija la fecha simulada exacta (R07, R09). */
  @Put('fecha')
  @Roles('R07', 'R09')
  cambiar(@Body() dto: FechaDto, @UsuarioActual() u: UsuarioSesion) {
    return this.simulacion.cambiarFecha(dto.fecha, u.id);
  }

  /** Avanza o retrocede la fecha simulada N días (R07, R09). */
  @Post('avanzar')
  @HttpCode(200)
  @Roles('R07', 'R09')
  avanzar(@Body() dto: AvanzarDto, @UsuarioActual() u: UsuarioSesion) {
    return this.simulacion.avanzar(dto.dias, u.id);
  }

  /** Vuelve la fecha a 30/06/2027 sin tocar los datos (R07, R09). */
  @Post('restablecer')
  @HttpCode(200)
  @Roles('R07', 'R09')
  restablecer(@UsuarioActual() u: UsuarioSesion) {
    return this.simulacion.cambiarFecha(FECHA_INICIAL, u.id);
  }
}

@ApiTags('Configuración')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  /** Parámetros del sistema: costos, tasas, tolerancia de conteo y umbrales de alertas. */
  @Get()
  @Roles(...LECTURA)
  listar() {
    return this.prisma.configuracionSistema.findMany({ orderBy: { clave: 'asc' } });
  }

  /** Cambia un parámetro (R07). La fecha simulada se cambia en /api/simulacion/fecha. */
  @Put(':clave')
  @Roles('R07')
  async cambiar(@Param('clave') clave: string, @Body() dto: ValorConfiguracionDto, @UsuarioActual() u: UsuarioSesion) {
    if (clave === 'fechaSimulada') throw new ErrorNegocio(400, 'CLAVE_PROTEGIDA', 'La fecha simulada se cambia con PUT /api/simulacion/fecha');
    if (!(await this.prisma.configuracionSistema.findUnique({ where: { clave } }))) throw new ErrorNegocio(404, 'NO_ENCONTRADO', `La clave ${clave} no existe`);
    await this.simulacion.guardar(clave, dto.valor, u.id);
    return this.prisma.configuracionSistema.findUnique({ where: { clave } });
  }
}
