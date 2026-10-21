import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SimulacionService {
  constructor(private readonly prisma: PrismaService) {}

  // Fecha de operación simulada guardada en ConfiguracionSistema ("AAAA-MM-DD").
  async fechaSimulada(): Promise<string | null> {
    const config = await this.prisma.configuracionSistema.findUnique({ where: { clave: 'fechaSimulada' } });
    return (config?.valor as string | undefined) ?? null;
  }

  async fechaOperacion(): Promise<Date> {
    return new Date(`${(await this.fechaSimulada()) ?? '2027-06-30'}T00:00:00Z`);
  }
}
