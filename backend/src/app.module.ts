import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludModule } from './salud/salud.module.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { AlertasModule } from './alertas/alertas.module.js';
import { ArticulosModule } from './articulos/articulos.module.js';
import { AlmacenesModule } from './almacenes/almacenes.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { SimulacionModule } from './simulacion/simulacion.module.js';

@Module({
  imports: [
    PrismaModule,
    SaludModule,
    InventarioModule,
    AlertasModule,
    ArticulosModule,
    AlmacenesModule,
    UsuariosModule,
    SimulacionModule,
  ],
})
export class AppModule {}
