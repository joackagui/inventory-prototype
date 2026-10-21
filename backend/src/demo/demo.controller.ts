import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorNegocio } from '../comun/errores.js';
import { verificarIntegridad } from '../inventario/integridad.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FECHA_INICIAL, SimulacionService } from '../simulacion/simulacion.service.js';
import { LECTURA, Roles, UsuarioActual, type UsuarioSesion } from '../usuarios/autorizacion.js';
import { ESCENARIOS, EscenarioDto, RestablecerDto } from './demo.dto.js';
import { estadoDemo } from './estado.js';
import { sembrar } from './sembrar.js';

@ApiTags('Demo')
@Controller('simulacion')
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  /** Escenarios de demo disponibles (fecha y qué se verá). */
  @Get('escenarios')
  @Roles(...LECTURA)
  escenarios() {
    return Object.entries(ESCENARIOS).map(([nombre, e]) => ({ nombre, ...e }));
  }

  /** Atajo de demo (R07, R09): solo fija la fecha simulada del escenario; reevalúa las alertas y no toca movimientos. */
  @Post('escenario')
  @HttpCode(200)
  @Roles('R07', 'R09')
  async escenario(@Body() dto: EscenarioDto, @UsuarioActual() u: UsuarioSesion) {
    return { escenario: dto.nombre, ...(await this.simulacion.cambiarFecha(ESCENARIOS[dto.nombre].fecha, u.id)) };
  }

  /** Vuelve a sembrar el estado base del 30/06/2027 (R07, R09). Requiere DEMO_MODE=true y escribir RESTABLECER. */
  @Post('restablecer-datos')
  @HttpCode(200)
  @Roles('R07', 'R09')
  async restablecer(@Body() _dto: RestablecerDto, @UsuarioActual() u: UsuarioSesion) {
    if (process.env.DEMO_MODE !== 'true') throw new ErrorNegocio(403, 'DEMO_DESACTIVADA', 'Restablecer datos solo está disponible con DEMO_MODE=true');
    if (estadoDemo.restableciendo) throw new ErrorNegocio(503, 'DEMO_RESTABLECIENDO', 'Ya se están restableciendo los datos');
    estadoDemo.restableciendo = true;
    const inicio = performance.now();
    try {
      await sembrar(this.prisma, { silencioso: true });
      // El seed vacía la bitácora: el restablecimiento queda como su primer registro (los ids de usuario son deterministas).
      await this.prisma.registroCambio.create({ data: { usuarioId: u.id, entidad: 'Demo', entidadId: 'datos', campo: 'restablecimiento', valorNuevo: { fechaSimulada: FECHA_INICIAL, por: u.codigo }, fechaOperacion: new Date(`${FECHA_INICIAL}T00:00:00Z`) } });
      const integridad = await verificarIntegridad(this.prisma, await this.simulacion.fechaOperacion());
      const alertas = await this.prisma.alerta.count({ where: { estado: { in: ['ABIERTA', 'ATENDIDA'] } } });
      return { fechaSimulada: FECHA_INICIAL, alertasVigentes: alertas, segundos: Math.round(performance.now() - inicio) / 1000, integridad };
    } finally {
      estadoDemo.restableciendo = false;
    }
  }
}
