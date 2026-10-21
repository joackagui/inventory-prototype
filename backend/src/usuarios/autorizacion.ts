import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorNegocio } from '../comun/errores.js';
import type { Usuario } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type CodigoRol = 'R01' | 'R02' | 'R06' | 'R07' | 'R08' | 'R09';
export type UsuarioSesion = Usuario;

// Roles que pueden consultar con costos (todos menos el preventista).
export const LECTURA: CodigoRol[] = ['R02', 'R06', 'R07', 'R08', 'R09'];
export const TODOS: CodigoRol[] = ['R01', ...LECTURA];
// Registran operaciones de almacén: R06 en su almacén, R07 en los tres.
export const OPERAN: CodigoRol[] = ['R06', 'R07'];

const CLAVE_ROLES = 'roles';
const CLAVE_PUBLICO = 'publico';
export const Roles = (...roles: CodigoRol[]) => SetMetadata(CLAVE_ROLES, roles);
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ usuario: UsuarioSesion }>().usuario,
);

// Sin contraseñas: el encabezado X-Usuario identifica al usuario; el rol decide qué puede hacer.
@Injectable()
export class UsuarioGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown>; usuario?: UsuarioSesion }>();
    const codigo = req.headers['x-usuario'];
    if (typeof codigo !== 'string' || !codigo) {
      throw new ErrorNegocio(401, 'NO_AUTENTICADO', 'Falta el encabezado X-Usuario con el código del usuario (por ejemplo ALM-LP)');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { codigo } });
    if (!usuario) throw new ErrorNegocio(401, 'NO_AUTENTICADO', `El usuario ${codigo} no existe`);
    req.usuario = usuario;
    const roles = this.reflector.getAllAndOverride<CodigoRol[] | undefined>(CLAVE_ROLES, objetivos);
    if (roles && !roles.includes(usuario.rolCodigo as CodigoRol)) {
      throw new ErrorNegocio(403, 'SIN_PERMISO', `El rol ${usuario.rolCodigo} (${usuario.codigo}) no puede realizar esta operación`);
    }
    return true;
  }
}

// R06 solo opera su almacén asignado; R07 opera los tres.
export function exigirAlmacen(usuario: UsuarioSesion, almacenId: number) {
  if (usuario.rolCodigo === 'R06' && usuario.almacenId !== almacenId) {
    throw new ErrorNegocio(403, 'ALMACEN_AJENO', `${usuario.codigo} solo puede operar su almacén asignado`);
  }
}
