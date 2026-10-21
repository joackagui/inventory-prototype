import { Global, Module } from '@nestjs/common';
import { IntegracionController } from './integracion.controller.js';
import { ConfiguracionController, SimulacionController } from './simulacion.controller.js';
import { SimulacionService } from './simulacion.service.js';

// Global: todas las operaciones necesitan la fecha simulada.
@Global()
@Module({
  controllers: [SimulacionController, ConfiguracionController, IntegracionController],
  providers: [SimulacionService],
  exports: [SimulacionService],
})
export class SimulacionModule {}
