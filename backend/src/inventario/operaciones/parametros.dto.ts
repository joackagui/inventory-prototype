import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { ClaseAbc } from '../../generated/prisma/enums.js';

export class ParametrosDto {
  /** Demanda diaria d. @example 150 */
  @IsOptional() @IsInt() @Min(0) demandaDiaria?: number;
  /** Desviación estándar diaria σd. @example 17 */
  @IsOptional() @IsNumber() @Min(0) desviacionDemanda?: number;
  /** Lead time L en días. @example 3 */
  @IsOptional() @IsInt() @IsPositive() leadTimeDias?: number;
  /** @example 'A' */
  @IsOptional() @IsEnum(ClaseAbc) claseAbc?: ClaseAbc;
  /** Entre 0 y 1 (0.98 = 98%). @example 0.98 */
  @IsOptional() @IsNumber() @Min(0.5) @Max(0.9999) nivelServicio?: number;
}
