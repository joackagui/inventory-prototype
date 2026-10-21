import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class RecepcionDto {
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 'PICK-A' */
  @IsString() @IsNotEmpty() ubicacion: string;
  /** @example 'ART-10021' */
  @IsString() @IsNotEmpty() articulo: string;
  /** Cajas o packs. @example 600 */
  @IsInt() @IsPositive() cantidad: number;
  /** USD por caja. @example 12.7 */
  @IsNumber() @Min(0.01) costoUnitario: number;
  /** @example 'LP-10021-270629' */
  @IsString() @IsNotEmpty() lote: string;
  /** @example '2027-06-29' */
  @IsDateString({ strict: true }) fechaElaboracion: string;
}

export class PreviaRecepcionDto {
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 'ART-10021' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 14.9 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) costoUnitario?: number;
  /** @example '2027-06-29' */
  @IsOptional() @IsDateString({ strict: true }) fechaElaboracion?: string;
  /** @example 'LP-10021-270629' */
  @IsOptional() @IsString() lote?: string;
}
