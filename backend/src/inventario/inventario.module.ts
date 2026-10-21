import { Module } from '@nestjs/common';
import { SimulacionModule } from '../simulacion/simulacion.module.js';
import { InventarioController } from './inventario.controller.js';

@Module({ imports: [SimulacionModule], controllers: [InventarioController] })
export class InventarioModule {}
