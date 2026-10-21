import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags } from '@nestjs/swagger';
import { ErrorNegocio, noEncontrado } from '../comun/errores.js';
import { EVENTO_EVALUAR } from '../inventario/motor.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../usuarios/autorizacion.js';
import { FallaIntegracionDto } from './simulacion.dto.js';
import { SimulacionService } from './simulacion.service.js';

@ApiTags('Integración (simulada)')
@Controller()
export class IntegracionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
    private readonly eventos: EventEmitter2,
  ) {}

  /** Simula una falla de integración o conciliación (dispara AL16). */
  @Post('simulacion/falla-integracion')
  @Roles('R07', 'R09')
  async falla(@Body() dto: FallaIntegracionDto) {
    const n = (await this.prisma.eventoIntegracion.count()) + 1;
    const evento = await this.prisma.eventoIntegracion.create({
      data: {
        tipo: dto.tipo ?? 'CONCILIACION_VENTAS',
        referencia: dto.referencia ?? `SIM-${String(n).padStart(4, '0')}`,
        estado: dto.estado,
        intentos: dto.estado === 'COLA_ERRORES' ? 3 : 1,
        fechaOperacion: await this.simulacion.fechaOperacion(),
      },
    });
    await this.eventos.emitAsync(EVENTO_EVALUAR);
    return evento;
  }

  /** Eventos de integración simulados. */
  @Get('integracion/eventos')
  @Roles('R07', 'R09')
  listar() {
    return this.prisma.eventoIntegracion.findMany({ orderBy: { id: 'desc' } });
  }

  /** Reprocesa el evento (R09): queda PROCESADO y AL16 se resuelve. */
  @Post('integracion/eventos/:id/reprocesar')
  @HttpCode(200)
  @Roles('R09')
  async reprocesar(@Param('id', ParseIntPipe) id: number) {
    const evento = await this.prisma.eventoIntegracion.findUnique({ where: { id } });
    if (!evento) throw noEncontrado(`El evento ${id}`);
    if (evento.estado === 'PROCESADO') throw new ErrorNegocio(409, 'EVENTO_YA_PROCESADO', `El evento ${evento.referencia} ya fue procesado`);
    const r = await this.prisma.eventoIntegracion.update({ where: { id }, data: { estado: 'PROCESADO', procesadoEn: new Date(), intentos: { increment: 1 } } });
    await this.eventos.emitAsync(EVENTO_EVALUAR);
    return r;
  }
}
