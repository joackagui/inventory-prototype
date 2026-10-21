import { IsDateString, IsDefined, IsInt } from 'class-validator';
import type { Prisma } from '../generated/prisma/client.js';

export class FechaDto {
  /** @example '2027-07-15' */
  @IsDateString({ strict: true })
  fecha: string;
}

export class AvanzarDto {
  /** Días a avanzar (negativo para retroceder). @example 7 */
  @IsInt()
  dias: number;
}

export class ValorConfiguracionDto {
  /** Nuevo valor (número, texto u objeto JSON). @example 0.5 */
  @IsDefined()
  valor: Prisma.InputJsonValue;
}
