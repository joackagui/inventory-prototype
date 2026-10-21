import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller.js';

@Module({ controllers: [UsuariosController] })
export class UsuariosModule {}
