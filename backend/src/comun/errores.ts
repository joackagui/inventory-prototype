import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

// Error de negocio con el formato común de la API: { codigo, mensaje, detalles }.
export class ErrorNegocio extends HttpException {
  constructor(status: number, codigo: string, mensaje: string, detalles: unknown = null) {
    super({ codigo, mensaje, detalles }, status);
  }
}

export const noEncontrado = (que: string) => new ErrorNegocio(404, 'NO_ENCONTRADO', `${que} no existe`);

const POR_ESTADO: Record<number, [string, string]> = {
  400: ['SOLICITUD_INVALIDA', 'Los datos enviados no son válidos'],
  401: ['NO_AUTENTICADO', 'Falta el encabezado X-Usuario o el usuario no existe'],
  403: ['SIN_PERMISO', 'No tienes permiso para esta operación'],
  404: ['NO_ENCONTRADO', 'Recurso no encontrado'],
  409: ['CONFLICTO', 'La operación entra en conflicto con el estado actual'],
};

@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let cuerpo: unknown = { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor', detalles: null };
    const prismaCodigo = (error as { code?: string })?.code;
    if (error instanceof HttpException) {
      status = error.getStatus();
      const r = error.getResponse() as { codigo?: string; message?: unknown };
      if (typeof r === 'object' && r?.codigo) cuerpo = r;
      else {
        const [codigo, mensaje] = POR_ESTADO[status] ?? ['ERROR', error.message];
        const detalles = typeof r === 'object' ? (r?.message ?? null) : r;
        // ParseIntPipe: "Validation failed (numeric string is expected)".
        cuerpo = { codigo, mensaje, detalles: typeof detalles === 'string' && detalles.includes('numeric string') ? 'El identificador debe ser un número entero' : detalles };
      }
    } else if (prismaCodigo === 'P2025') {
      status = 404;
      cuerpo = { codigo: 'NO_ENCONTRADO', mensaje: 'Recurso no encontrado', detalles: null };
    } else if (prismaCodigo === 'P2034') {
      status = 409;
      cuerpo = { codigo: 'CONFLICTO_CONCURRENCIA', mensaje: 'Otra operación modificó los mismos datos; reintenta', detalles: null };
    } else {
      console.error(error);
    }
    res.status(status).json(cuerpo);
  }
}
