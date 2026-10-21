import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller.js';
import { AjustesController } from './operaciones/ajustes.controller.js';
import { AjustesService } from './operaciones/ajustes.service.js';
import { ConteosController } from './operaciones/conteos.controller.js';
import { ConteosService } from './operaciones/conteos.service.js';
import { CuarentenaController } from './operaciones/cuarentena.controller.js';
import { CuarentenaService } from './operaciones/cuarentena.service.js';
import { EnvasesController } from './operaciones/envases.controller.js';
import { EnvasesService } from './operaciones/envases.service.js';
import { ParametrosController } from './operaciones/parametros.controller.js';
import { ParametrosService } from './operaciones/parametros.service.js';
import { PedidosController } from './operaciones/pedidos.controller.js';
import { PromocionesController } from './operaciones/promociones.controller.js';
import { PromocionesService } from './operaciones/promociones.service.js';
import { PedidosService } from './operaciones/pedidos.service.js';
import { RecepcionController } from './operaciones/recepcion.controller.js';
import { RecepcionService } from './operaciones/recepcion.service.js';
import { TrasladosController } from './operaciones/traslados.controller.js';
import { TrasladosService } from './operaciones/traslados.service.js';

@Module({
  controllers: [InventarioController, RecepcionController, PedidosController, TrasladosController, ConteosController, AjustesController, CuarentenaController, EnvasesController, ParametrosController, PromocionesController],
  providers: [RecepcionService, PedidosService, TrasladosService, ConteosService, AjustesService, CuarentenaService, EnvasesService, ParametrosService, PromocionesService],
})
export class InventarioModule {}
