import { Module } from '@nestjs/common';
import { SimulacionModule } from '../simulacion/simulacion.module.js';
import { ArticulosController } from './articulos.controller.js';

@Module({ imports: [SimulacionModule], controllers: [ArticulosController] })
export class ArticulosModule {}
