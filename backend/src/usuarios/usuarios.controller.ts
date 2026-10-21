import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CodigoRol, Publico, Roles, TODOS, UsuarioActual, type UsuarioSesion } from './autorizacion.js';

// Resumen legible de docs/PERMISOS.md por rol (el detalle por ruta está en los @Roles de cada controlador).
const RESUMEN_PERMISOS: Record<CodigoRol, string[]> = {
  R01: ['Consulta disponible o agotado por almacén', 'Crea y cancela pedidos simulados (reserva)', 'No ve costos ni alertas'],
  R02: ['Propone promociones', 'Consulta envases sin devolver, alertas, análisis y fiestas', 'Atiende AL02, AL10 y AL15'],
  R03: ['Consulta pedidos, traslados, alertas y análisis', 'Atiende AL11 (pedidos pendientes por falta de stock)'],
  R06: ['Opera solo su almacén: recibe, despacha, cuenta, registra ajustes y mermas, cuarentena y envases', 'Despacha y recibe traslados de su almacén', 'No aprueba ajustes'],
  R07: ['Opera los 3 almacenes y emite traslados', 'Aprueba o rechaza ajustes, mermas, diferencias y promociones (no lo que registró)', 'Edita parámetros, umbrales y configuración; fecha simulada y herramientas de demo'],
  R08: ['Solo lectura: tablero, alertas, análisis, fiestas, costos y aprobaciones'],
  R09: ['Usuarios, bitácora e integridad', 'Fecha simulada, restablecer datos y simular fallas', 'Reprocesa eventos de integración (AL16)'],
};

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

  /** Usuarios con su rol, almacén y resumen de permisos (docs/PERMISOS.md). */
  @Get('usuarios/permisos')
  @Roles('R07', 'R08', 'R09')
  async permisos() {
    const usuarios = await this.prisma.usuario.findMany({ include: { rol: true, almacen: { select: { codigo: true } } }, orderBy: { id: 'asc' } });
    return usuarios.map((u) => ({ codigo: u.codigo, nombre: u.nombre, rol: u.rol.codigo, rolNombre: u.rol.nombre, almacen: u.almacen?.codigo ?? null, permisos: RESUMEN_PERMISOS[u.rol.codigo as CodigoRol] ?? [] }));
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
