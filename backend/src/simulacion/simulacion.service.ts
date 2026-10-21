import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio } from '../comun/errores.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EVENTO_EVALUAR } from '../inventario/motor.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const FECHA_INICIAL = '2027-06-30';

@Injectable()
export class SimulacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Fecha de operación simulada guardada en ConfiguracionSistema ("AAAA-MM-DD").
  async fechaSimulada(): Promise<string | null> {
    return this.valor<string | null>('fechaSimulada', null);
  }

  async fechaOperacion(): Promise<Date> {
    return new Date(`${(await this.fechaSimulada()) ?? FECHA_INICIAL}T00:00:00Z`);
  }

  async valor<T>(clave: string, defecto: T): Promise<T> {
    const config = await this.prisma.configuracionSistema.findUnique({ where: { clave } });
    return (config?.valor as T | undefined) ?? defecto;
  }

  diasMinimosDespacho() {
    return this.valor('diasMinimosVidaDespacho', 15);
  }

  async cambiarFecha(fecha: string, usuarioId: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
      throw new ErrorNegocio(400, 'FECHA_INVALIDA', 'La fecha debe tener el formato AAAA-MM-DD');
    }
    const anterior = await this.fechaSimulada();
    await this.guardar('fechaSimulada', fecha, usuarioId, 'Fecha de operación simulada (AAAA-MM-DD)');
    // Casi todas las alertas dependen del tiempo: evaluación completa; se devuelve cuántas cambiaron.
    const [alertas] = await this.eventos.emitAsync(EVENTO_EVALUAR);
    return { fechaSimulada: fecha, fechaAnterior: anterior, alertas: alertas ?? null };
  }

  async avanzar(dias: number, usuarioId: number) {
    const actual = await this.fechaOperacion();
    return this.cambiarFecha(new Date(actual.getTime() + dias * 86_400_000).toISOString().slice(0, 10), usuarioId);
  }

  // Guarda un valor de configuración y deja el cambio en la bitácora.
  async guardar(clave: string, valor: Prisma.InputJsonValue, usuarioId: number, descripcion = clave) {
    const anterior = await this.prisma.configuracionSistema.findUnique({ where: { clave } });
    const fecha = await this.fechaOperacion();
    await this.prisma.$transaction([
      this.prisma.configuracionSistema.upsert({ where: { clave }, update: { valor }, create: { clave, valor, descripcion } }),
      this.prisma.registroCambio.create({
        data: { usuarioId, entidad: 'ConfiguracionSistema', entidadId: clave, campo: 'valor', valorAnterior: (anterior?.valor ?? undefined) as Prisma.InputJsonValue | undefined, valorNuevo: valor, fechaOperacion: fecha },
      }),
    ]);
  }
}
