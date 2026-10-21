import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { EstadoPromocion, TipoPromocion } from '../../generated/prisma/enums.js';

export class PromocionDto {
  /** @example 'Pack Pepsi de regalo' */
  @IsString() @IsNotEmpty() nombre: string;
  /** @example 'BONIFICACION' */
  @IsEnum(TipoPromocion) tipo: TipoPromocion;
  /** @example 'ART-20011' */
  @IsString() @IsNotEmpty() articulo: string;
  /** Sin almacén aplica a los tres. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
  /** @example '2027-07-01' */
  @IsDateString({ strict: true }) fechaInicio: string;
  /** @example '2027-07-31' */
  @IsDateString({ strict: true }) fechaFin: string;
  /** @example 200 */
  @IsInt() @IsPositive() topeCajas: number;
  /** @example 10 */
  @IsOptional() @IsNumber() @Min(0) @Max(100) descuentoPct?: number;
  /** Capa a la que aplica (liquidación por vencimiento). @example 12 */
  @IsOptional() @IsInt() @IsPositive() capaId?: number;
}

export class AprobarPromocionDto {
  /** Identificador del correo del Gerente de Logística y Ventas que autoriza. @example 'CORREO-GLV-2027-0412' */
  @IsString() @IsNotEmpty() referenciaCorreo: string;
}

export class FiltroPromocionesDto {
  @IsOptional() @IsEnum(EstadoPromocion) estado?: EstadoPromocion;
}

export class RechazarPromocionDto {
  /** Motivo del rechazo (obligatorio). @example 'Tope demasiado alto para el stock disponible' */
  @IsString() @IsNotEmpty() comentario: string;
}
