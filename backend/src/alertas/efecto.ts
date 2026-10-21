import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { mergeMap } from 'rxjs';
import type { PrismaClient } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface FotoAlerta {
  id: number;
  codigo: string;
  almacen: string | null;
  articulo: string | null;
  color: string;
  mensaje: string;
}

async function fotoAlertas(prisma: PrismaClient) {
  const vigentes = await prisma.alerta.findMany({
    where: { estado: { in: ['ABIERTA', 'ATENDIDA'] } },
    include: { almacen: { select: { codigo: true } }, articulo: { select: { codigo: true } } },
  });
  return new Map<string, FotoAlerta>(vigentes.map((a) => [a.clave, { id: a.id, codigo: a.codigo, almacen: a.almacen?.codigo ?? null, articulo: a.articulo?.codigo ?? null, color: a.color, mensaje: a.mensaje }]));
}

// Diferencia entre dos fotos: alertas creadas, resueltas y con cambio de color.
export function compararAlertas(antes: Map<string, FotoAlerta>, despues: Map<string, FotoAlerta>) {
  const fila = (a: FotoAlerta, colorAntes: string | null, colorDespues: string | null) => ({ id: a.id, codigo: a.codigo, almacen: a.almacen, articulo: a.articulo, colorAntes, colorDespues, mensaje: a.mensaje });
  return {
    creadas: [...despues].filter(([k]) => !antes.has(k)).map(([, a]) => fila(a, null, a.color)),
    resueltas: [...antes].filter(([k]) => !despues.has(k)).map(([, a]) => fila(a, a.color, null)),
    cambiadas: [...despues].filter(([k, a]) => antes.has(k) && antes.get(k)!.color !== a.color).map(([k, a]) => fila(a, antes.get(k)!.color, a.color)),
  };
}

// Toda escritura (POST/PUT) responde con su efecto en alertas: la evaluación termina antes de responder,
// así que basta comparar las alertas vigentes antes y después.
// shortcut: si otra persona opera al mismo tiempo, su efecto puede aparecer aquí; suficiente para una demo de un solo puesto.
@Injectable()
export class EfectoAlertasInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler) {
    const { method } = ctx.switchToHttp().getRequest<{ method: string }>();
    if (method !== 'POST' && method !== 'PUT') return next.handle();
    const antes = await fotoAlertas(this.prisma);
    return next.handle().pipe(
      mergeMap(async (r: unknown) => (r && typeof r === 'object' && !Array.isArray(r) ? { ...r, efectoAlertas: compararAlertas(antes, await fotoAlertas(this.prisma)) } : r)),
    );
  }
}
