import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ColorAlerta, EstadoAlerta } from '../generated/prisma/enums.js';

export class FiltroAlertasDto {
  @IsOptional() @IsEnum(EstadoAlerta) estado?: EstadoAlerta;
  @IsOptional() @IsEnum(ColorAlerta) color?: ColorAlerta;
  /** @example 'AL01' */
  @IsOptional() @Matches(/^AL\d{2}$/) codigo?: string;
  /** Código del almacén. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
  /** @example 'ART-10022' */
  @IsOptional() @IsString() articulo?: string;
  /** Rol responsable. @example 'R06' */
  @IsOptional() @IsString() rol?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) tamano = 100;
}

export class AlmacenAlertasDto {
  /** Id o código del almacén. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacenId?: string;
}

export class AtenderDto {
  /** Qué se hizo. @example 'Traslado OT-2027-0002 emitido' */
  @IsString() @IsNotEmpty() resultado: string;
  /** @example 'Llega el jueves' */
  @IsOptional() @IsString() comentario?: string;
}

export class UmbralDto {
  /** Campos del umbral a cambiar. @example { "amarilloDias": 40 } */
  @IsObject() valor: Record<string, unknown>;
}
