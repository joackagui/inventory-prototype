import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class EnvaseDto {
  /** @example 'Cliente 001' */
  @IsString() @IsNotEmpty() cliente: string;
  /** Artículo con envase retornable. @example 'ART-10021' */
  @IsString() @IsNotEmpty() articulo: string;
  /** @example 'CD-LP-01' */
  @IsString() @IsNotEmpty() almacen: string;
  /** @example 30 */
  @IsInt() @IsPositive() cantidad: number;
}

export class FiltroEnvasesDto {
  /** @example 'Cliente 003' */
  @IsOptional() @IsString() cliente?: string;
  /** @example 'CD-LP-01' */
  @IsOptional() @IsString() almacen?: string;
}
