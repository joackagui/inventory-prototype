import { Module } from '@nestjs/common';
import { ArticulosController } from './articulos.controller.js';

@Module({ controllers: [ArticulosController] })
export class ArticulosModule {}
