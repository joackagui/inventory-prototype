import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles, TODOS } from '../usuarios/autorizacion.js';

@ApiTags('Almacenes')
@Roles(...TODOS)
@Controller('almacenes')
export class AlmacenesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Plantas y almacenes de tránsito con sus ubicaciones. */
  @Get()
  listar() {
    return this.prisma.almacen.findMany({
      include: { ubicaciones: true, almacenTransito: { select: { id: true, codigo: true } } },
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    });
  }
}
