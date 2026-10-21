import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OPERAN, Roles, TODOS, UsuarioActual, type UsuarioSesion } from '../../usuarios/autorizacion.js';
import { PedidosService } from './pedidos.service.js';
import { FiltroPedidosDto, PedidoDto } from './pedidos.dto.js';

@ApiTags('Pedidos')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly servicio: PedidosService) {}

  /** Crea un pedido simulado y reserva el stock (todo o nada). Sin stock suficiente: 409 con el faltante y pedido PENDIENTE_REVISION. */
  @Post()
  @Roles('R01')
  crear(@Body() dto: PedidoDto, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  /** Pedidos simulados. */
  @Get()
  @Roles(...TODOS)
  listar(@Query() filtro: FiltroPedidosDto) {
    return this.servicio.listar(filtro);
  }

  /** Despacha el pedido (R06 del almacén): salida FIFO valorada al costo de cada capa. */
  @Post(':id/despachar')
  @HttpCode(200)
  @Roles(...OPERAN)
  despachar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.despachar(id, u);
  }

  /** Cancela el pedido y libera la reserva. */
  @Post(':id/cancelar')
  @HttpCode(200)
  @Roles('R01', ...OPERAN)
  cancelar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.cancelar(id, u);
  }
}
