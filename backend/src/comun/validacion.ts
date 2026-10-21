import type { ValidationError } from '@nestjs/common';
import { ErrorNegocio } from './errores.js';

const numero = (m: string) => m.match(/-?\d+(\.\d+)?/)?.[0] ?? '';

// Mensajes de class-validator en español (las restricciones que usan los DTOs).
const MENSAJES: Record<string, (campo: string, original: string) => string> = {
  isString: (c) => `${c} debe ser un texto`,
  isNotEmpty: (c) => `${c} no puede estar vacío`,
  isDefined: (c) => `${c} es obligatorio`,
  isInt: (c) => `${c} debe ser un número entero`,
  isNumber: (c) => `${c} debe ser un número`,
  isPositive: (c) => `${c} debe ser mayor que 0`,
  min: (c, m) => `${c} no puede ser menor que ${numero(m)}`,
  max: (c, m) => `${c} no puede ser mayor que ${numero(m)}`,
  notEquals: (c) => `${c} no puede ser 0`,
  isDateString: (c) => `${c} debe ser una fecha con formato AAAA-MM-DD`,
  isEnum: (c, m) => `${c} debe ser uno de: ${m.split(': ').at(-1)}`,
  isIn: (c, m) => `${c} debe ser uno de: ${m.split(': ').at(-1)}`,
  isBoolean: (c) => `${c} debe ser verdadero o falso`,
  isArray: (c) => `${c} debe ser una lista`,
  arrayNotEmpty: (c) => `${c} debe tener al menos un elemento`,
  isObject: (c) => `${c} debe ser un objeto`,
  matches: (c) => `${c} no tiene el formato esperado`,
  equals: (c, m) => `${c} debe ser exactamente ${m.split(' ').at(-1)}`,
  whitelistValidation: (c) => `${c} no es un campo permitido`,
  nestedValidation: (c) => `${c} debe ser un objeto válido`,
};

function aplanar(errores: ValidationError[], prefijo = ''): string[] {
  return errores.flatMap((e) => {
    const campo = `${prefijo}${e.property}`;
    const propios = Object.entries(e.constraints ?? {}).map(([regla, original]) => MENSAJES[regla]?.(campo, original) ?? `${campo}: ${original}`);
    return [...propios, ...aplanar(e.children ?? [], `${campo}.`)];
  });
}

export const errorDeValidacion = (errores: ValidationError[]) => new ErrorNegocio(400, 'SOLICITUD_INVALIDA', 'Los datos enviados no son válidos', aplanar(errores));
