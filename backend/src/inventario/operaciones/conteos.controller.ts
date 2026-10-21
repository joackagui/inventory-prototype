import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LECTURA, OPERAN, Roles, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { ConteosService } from './conteos.service.js';
import { ConteoDto, FiltroAlmacenDto } from './conteos.dto.js';

@ApiTags('Conteos')
@Controller('conteos')
export class ConteosController {
  constructor(private readonly servicio: ConteosService) {}

  /** Registra un conteo físico (R06 de su almacén). La diferencia genera un ajuste PENDIENTE; sobre la tolerancia pide recuento. */
  @Post()
  @Roles(...OPERAN)
  registrar(@Body() dto: ConteoDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.registrar(dto, u);
  }

  /** Conteos registrados. */
  @Get()
  @Roles(...LECTURA)
  listar(@Query() q: FiltroAlmacenDto) {
    return this.servicio.listar(q.almacen);
  }
}
