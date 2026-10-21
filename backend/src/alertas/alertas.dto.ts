import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ColorAlerta, EstadoAlerta } from '../generated/prisma/enums.js';

const booleano = () => Transform(({ value }) => value === true || value === 'true');

export class FiltroAlertasDto {
  /** VIGENTE = ABIERTA o ATENDIDA. @example 'VIGENTE' */
  @IsOptional() @IsIn([...Object.values(EstadoAlerta), 'VIGENTE']) estado?: EstadoAlerta | 'VIGENTE';
  @IsOptional() @IsEnum(ColorAlerta) color?: ColorAlerta;
  /** @example 'AL01' */
  @IsOptional() @Matches(/^AL\d{2}$/) codigo?: string;
  /** Varios códigos separados por coma (familia). @example 'AL01,AL02,AL03' */
  @IsOptional() @Matches(/^AL\d{2}(,AL\d{2})*$/) codigos?: string;
  /** Solo las ABIERTAS (sin atender). */
  @IsOptional() @booleano() @IsBoolean() sinAtender?: boolean;
  /** Solo las escaladas (nivel 1 o 2). */
  @IsOptional() @booleano() @IsBoolean() escaladas?: boolean;
  /** Código del almacén. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
  /** @example 'ART-10022' */
  @IsOptional() @IsString() articulo?: string;
  /** Rol responsable. @example 'R06' */
  @IsOptional() @IsString() rol?: string;
  /** gravedad: rojas sin atender primero, luego escaladas y más antiguas; antiguedad: las más antiguas primero. Sin estado, ambos muestran solo vigentes. @example 'gravedad' */
  @IsOptional() @IsIn(['gravedad', 'antiguedad']) orden?: 'gravedad' | 'antiguedad';
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
