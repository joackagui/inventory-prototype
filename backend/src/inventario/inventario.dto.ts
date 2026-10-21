import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TipoMovimiento } from '../generated/prisma/enums.js';

export class FiltroMovimientosDto {
  /** Código del almacén. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
  /** @example 'ART-10021' */
  @IsOptional() @IsString() articulo?: string;
  @IsOptional() @IsEnum(TipoMovimiento) tipo?: TipoMovimiento;
  /** @example '2027-06-01' */
  @IsOptional() @IsDateString() desde?: string;
  /** @example '2027-06-30' */
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) tamano = 50;
}
