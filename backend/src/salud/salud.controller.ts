import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SimulacionService } from '../simulacion/simulacion.service.js';
import { Publico } from '../usuarios/autorizacion.js';

@ApiTags('Salud')
@Publico()
@Controller('salud')
export class SaludController {
  constructor(private readonly simulacion: SimulacionService) {}

  /** Estado del backend, conexión con PostgreSQL y fecha simulada. */
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
