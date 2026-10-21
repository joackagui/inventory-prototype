import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class AlmacenOpcionalDto {
  /** Id o código del almacén; sin él, los tres. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacenId?: string;
}

export class CostosDto extends AlmacenOpcionalDto {
  /** Mes AAAA-MM; por defecto, el de la fecha simulada. @example '2027-06' */
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) mes?: string;
  /** Vista previa: tasa anual de conservación (no se guarda). @example 0.2 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) tasaConservacionAnual?: number;
  /** Vista previa: USD por traslado. @example 200 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) costoPorTraslado?: number;
  /** Vista previa: valor de un pedido no atendido (USD). @example 40 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPedidoAgotamiento?: number;
  /** Vista previa: margen perdido por pedido no atendido. @example 0.3 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) margenAgotamiento?: number;
}

export class ParetoDto extends AlmacenOpcionalDto {
  /** Fecha de aprobación desde (AAAA-MM-DD). @example '2027-06-01' */
  @IsOptional() @IsDateString({ strict: true }) desde?: string;
  /** @example '2027-06-30' */
  @IsOptional() @IsDateString({ strict: true }) hasta?: string;
}
