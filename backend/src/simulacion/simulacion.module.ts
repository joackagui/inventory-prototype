import { Global, Module } from '@nestjs/common';
import { ConfiguracionController, SimulacionController } from './simulacion.controller.js';
import { SimulacionService } from './simulacion.service.js';

// Global: todas las operaciones necesitan la fecha simulada.
@Global()
@Module({
  controllers: [SimulacionController, ConfiguracionController],
  providers: [SimulacionService],
  exports: [SimulacionService],
})
export class SimulacionModule {}
