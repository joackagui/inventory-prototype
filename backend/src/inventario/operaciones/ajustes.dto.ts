import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, NotEquals } from 'class-validator';
import { EstadoAjuste, MotivoAjuste } from '../../generated/prisma/enums.js';

export class AjusteDto {
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 'ART-10063' */
  @IsString() @IsNotEmpty() articulo: string;
  /** Con signo: negativo = baja. @example -6 */
  @IsInt() @NotEquals(0) cantidad: number;
  /** @example 'ROTURA' */
  @IsEnum(MotivoAjuste) motivo: MotivoAjuste;
  /** Capa afectada; sin ella, una baja consume FIFO. @example 12 */
  @IsOptional() @IsInt() @IsPositive() capaId?: number;
  /** @example 'Cajas rotas al descargar' */
  @IsOptional() @IsString() observacion?: string;
}

export class FiltroAjustesDto {
  @IsOptional() @IsEnum(EstadoAjuste) estado?: EstadoAjuste;
}

export class ResolverAjusteDto {
  /** Comentario de R07 (opcional al aprobar). @example 'Revisado con el jefe de almacén' */
  @IsOptional() @IsString() comentario?: string;
}

export class RechazarAjusteDto {
  /** Motivo del rechazo (obligatorio). @example 'El recuento cuadra con el sistema' */
  @IsString() @IsNotEmpty() comentario: string;
}

export class ImpactoAjusteDto {
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 'ART-10021' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example -6 */
  @Type(() => Number) @IsInt() @NotEquals(0) cantidad: number;
  /** @example 12 */
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() capaId?: number;
}
