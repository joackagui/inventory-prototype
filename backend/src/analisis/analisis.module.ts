import { Module } from '@nestjs/common';
import { AnalisisController } from './analisis.controller.js';
import { AnalisisService } from './analisis.service.js';

@Module({ controllers: [AnalisisController], providers: [AnalisisService] })
export class AnalisisModule {}
