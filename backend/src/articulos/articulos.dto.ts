import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TipoMovimiento } from '../generated/prisma/enums.js';

export class AlmacenArticuloDto {
  /** Id o código del almacén; sin él, los tres. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacenId?: string;
}

export class SerieDto {
  /** @example 'CD-LP-01' */
  @IsString() almacenId: string;
  /** Días hacia atrás desde la fecha simulada. @example 60 */
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365) dias = 60;
}

export class KardexDto {
  /** @example 'CD-LP-01' */
  @IsString() almacenId: string;
  @IsOptional() @IsEnum(TipoMovimiento) tipo?: TipoMovimiento;
  /** @example '2027-06-01' */
  @IsOptional() @IsDateString({ strict: true }) desde?: string;
  /** @example '2027-06-30' */
  @IsOptional() @IsDateString({ strict: true }) hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) tamano = 50;
}

export class FiltroCapasDto {
  /** @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
  /** @example 'ART-10063' */
  @IsOptional() @IsString() articulo?: string;
  /** @example 'CUARENTENA' */
  @IsOptional() @IsIn(['DISPONIBLE', 'CUARENTENA']) estado?: 'DISPONIBLE' | 'CUARENTENA';
}
