import { Equals, IsIn } from 'class-validator';

export const ESCENARIOS = {
  base: { fecha: '2027-06-30', descripcion: 'Estado base de la demo: 19 alertas vigentes.' },
  'una-semana-antes-aniversario': { fecha: '2027-07-09', descripcion: 'Una semana antes del Aniversario de La Paz: AL14 en rojo para los artículos que no alcanzan.' },
  vencimientos: { fecha: '2027-07-10', descripcion: 'La capa de 25 días del ART-10063 baja a 15 días (AL04 rojo) y la de 12 días ya venció.' },
  'navidad-8-semanas': { fecha: '2027-10-30', descripcion: 'Empieza la ventana de preparación de Navidad (8 semanas antes).' },
} as const;

export class RestablecerDto {
  /** Escribe RESTABLECER para confirmar. @example 'RESTABLECER' */
  @Equals('RESTABLECER') confirmacion: string;
}

export class EscenarioDto {
  /** @example 'vencimientos' */
  @IsIn(Object.keys(ESCENARIOS)) nombre: keyof typeof ESCENARIOS;
}
