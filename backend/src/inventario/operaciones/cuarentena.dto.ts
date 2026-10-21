import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CuarentenaDto {
  /** @example 12 */
  @IsInt() @IsPositive() capaId: number;
  /** @example 40 */
  @IsInt() @IsPositive() cantidad: number;
  /** @example 'Vence en 12 días' */
  @IsString() @IsNotEmpty() motivo: string;
}
