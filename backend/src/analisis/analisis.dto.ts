import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class AlmacenOpcionalDto {
  /** Id o código del almacén; sin él, los tres. @example 'CD-LP-01' */
  @IsOptional() @IsString() almacenId?: string;
}

export class CostosDto extends AlmacenOpcionalDto {
  /** Mes AAAA-MM; por defecto, el de la fecha simulada. @example '2027-06' */
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) mes?: string;
}

export class ParetoDto extends AlmacenOpcionalDto {
  /** Fecha de aprobación desde (AAAA-MM-DD). @example '2027-06-01' */
  @IsOptional() @IsDateString({ strict: true }) desde?: string;
  /** @example '2027-06-30' */
  @IsOptional() @IsDateString({ strict: true }) hasta?: string;
}
