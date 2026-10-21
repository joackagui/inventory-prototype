import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('almacenes')
export class AlmacenesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.almacen.findMany({
      include: { ubicaciones: true, almacenTransito: { select: { id: true, codigo: true } } },
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    });
  }
}
