import { Module } from '@nestjs/common';
import { SimulacionModule } from '../simulacion/simulacion.module.js';
import { SaludController } from './salud.controller.js';

@Module({ imports: [SimulacionModule], controllers: [SaludController] })
export class SaludModule {}
