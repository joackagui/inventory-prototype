import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { TipoConteo } from '../../generated/prisma/enums.js';

export class ConteoDto {
  /** @example 'CICLICO' */
  @IsEnum(TipoConteo) tipo: TipoConteo;
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 'PICK-B' */
  @IsString() @IsNotEmpty() ubicacion: string;
  /** @example 'ART-30005' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 207 */
  @IsInt() @Min(0) cantidadContada: number;
}

export class FiltroAlmacenDto {
  /** @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
}
