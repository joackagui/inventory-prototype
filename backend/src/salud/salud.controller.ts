import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async salud() {
    let baseDeDatos: 'conectada' | 'sin conexión' = 'conectada';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      baseDeDatos = 'sin conexión';
    }
    // fechaSimulada se conectará al módulo de simulación más adelante.
    return { estado: 'ok', baseDeDatos, fechaSimulada: null };
  }
}
