import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { EstadoPedido } from '../../generated/prisma/enums.js';

export class LineaPedidoDto {
  /** @example 'ART-10021' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 200 */
  @IsInt() @IsPositive() cantidad: number;
  /** Línea sin cargo por promoción BONIFICACION vigente. @example false */
  @IsOptional() @IsBoolean() bonificacion?: boolean;
}

export class PedidoDto {
  /** Código del cliente genérico. @example 'Cliente 001' */
  @IsString() @IsNotEmpty() cliente: string;
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => LineaPedidoDto) lineas: LineaPedidoDto[];
}

export class FiltroPedidosDto {
  @IsOptional() @IsEnum(EstadoPedido) estado?: EstadoPedido;
  /** @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
}
