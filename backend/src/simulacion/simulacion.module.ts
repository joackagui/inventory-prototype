import { Module } from '@nestjs/common';
import { SimulacionService } from './simulacion.service.js';

@Module({
  providers: [SimulacionService],
  exports: [SimulacionService],
})
export class SimulacionModule {}
