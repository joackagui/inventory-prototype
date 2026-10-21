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
