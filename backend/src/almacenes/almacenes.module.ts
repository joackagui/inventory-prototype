import { Module } from '@nestjs/common';
import { AlmacenesController } from './almacenes.controller.js';

@Module({ controllers: [AlmacenesController] })
export class AlmacenesModule {}
