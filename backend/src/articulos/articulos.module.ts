import { Module } from '@nestjs/common';
import { ArticulosController, CapasController } from './articulos.controller.js';
import { ArticulosService } from './articulos.service.js';

@Module({ controllers: [ArticulosController, CapasController], providers: [ArticulosService] })
export class ArticulosModule {}
