import { Controller, Get } from '@nestjs/common';
import { SimulacionService } from '../simulacion/simulacion.service.js';

@Controller('salud')
export class SaludController {
  constructor(private readonly simulacion: SimulacionService) {}

  @Get()
  async salud() {
    try {
      // Leer la fecha simulada también comprueba la conexión con PostgreSQL.
      return { estado: 'ok', baseDeDatos: 'conectada', fechaSimulada: await this.simulacion.fechaSimulada() };
    } catch {
      return { estado: 'ok', baseDeDatos: 'sin conexión', fechaSimulada: null };
    }
  }
}
