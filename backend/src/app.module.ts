import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AlertasModule } from './alertas/alertas.module.js';
import { AlmacenesModule } from './almacenes/almacenes.module.js';
import { AnalisisModule } from './analisis/analisis.module.js';
import { ArticulosModule } from './articulos/articulos.module.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludModule } from './salud/salud.module.js';
import { SimulacionModule } from './simulacion/simulacion.module.js';
import { UsuarioGuard } from './usuarios/autorizacion.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    // Evento "inventario.cambio" tras cada operación confirmada: punto de extensión para las alertas.
    EventEmitterModule.forRoot(),
    PrismaModule,
    SimulacionModule,
    SaludModule,
    InventarioModule,
    AlertasModule,
    AnalisisModule,
    ArticulosModule,
    AlmacenesModule,
    UsuariosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UsuarioGuard }],
})
export class AppModule {}
