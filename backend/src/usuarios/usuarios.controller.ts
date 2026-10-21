import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Publico, Roles, TODOS, UsuarioActual, type UsuarioSesion } from './autorizacion.js';

@ApiTags('Usuarios')
@Controller()
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  /** Usuarios genéricos con su rol y almacén (público: alimenta el selector de usuario). */
  @Get('usuarios')
  @Publico()
  listar() {
    return this.prisma.usuario.findMany({ include: { rol: true, almacen: { select: { id: true, codigo: true } } }, orderBy: { id: 'asc' } });
  }

  /** Clientes genéricos (pedidos y envases). */
  @Get('clientes')
  @Roles(...TODOS)
  clientes() {
    return this.prisma.cliente.findMany({ orderBy: { codigo: 'asc' } });
  }

  /** Usuario identificado por el encabezado X-Usuario. */
  @Get('yo')
  @Roles(...TODOS)
  yo(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.usuario.findUnique({ where: { id: u.id }, include: { rol: true, almacen: { select: { id: true, codigo: true } } } });
  }
}
