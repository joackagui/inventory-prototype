import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { EstadoRecepcion, EstadoTraslado } from '../../generated/prisma/enums.js';

export class LineaTrasladoDto {
  /** @example 'ART-10022' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 236 */
  @IsInt() @IsPositive() cantidad: number;
}

export class TrasladoDto {
  /** @example 'CD-SC-01' */
  @IsString() @IsNotEmpty() origen: string;
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() destino: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => LineaTrasladoDto) lineas: LineaTrasladoDto[];
}

export class LineaRecibidaDto {
  /** @example 'ART-10022' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 230 */
  @IsInt() @Min(0) cantidadRecibida: number;
  /** DANADO manda lo recibido a cuarentena (CUAR-01). @example 'CONFORME' */
  @IsOptional() @IsEnum(EstadoRecepcion) estado?: EstadoRecepcion;
  /** @example 'Faltan 6 cajas' */
  @IsOptional() @IsString() observacion?: string;
}

export class RecepcionTrasladoDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => LineaRecibidaDto) lineas: LineaRecibidaDto[];
}

export class FiltroTrasladosDto {
  @IsOptional() @IsEnum(EstadoTraslado) estado?: EstadoTraslado;
}

export class AlmacenQueryDto {
  /** Id o código del almacén. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacenId?: string;
}
