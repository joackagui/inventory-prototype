import type { PrismaClient } from '../generated/prisma/client.js';
import { calcularPosicion, cobertura, trasladoPropuesto, vidaRestanteDias } from './calculos/formulas.js';

// Acepta el id numérico o el código ("CD-LP-01").
export function resolverAlmacen(prisma: PrismaClient, valor: string) {
  return prisma.almacen.findUniqueOrThrow({
    where: /^\d+$/.test(valor) ? { id: Number(valor) } : { codigo: valor },
  });
}

// Estados del stock por artículo en un almacén (sección 6). Stock total = disponible + reservado (+ cuarentena).
export async function obtenerStock(prisma: PrismaClient, almacenId: number, fechaOperacion: Date) {
  const almacen = await prisma.almacen.findUniqueOrThrow({ where: { id: almacenId } });
  const [parametros, capas, reservas] = await Promise.all([
    prisma.parametroArticuloAlmacen.findMany({
      where: { almacenId },
      include: { articulo: true },
      orderBy: { articulo: { codigo: 'asc' } },
    }),
    prisma.capaFifo.findMany({
      where: { almacenId: { in: [almacenId, almacen.almacenTransitoId ?? -1] }, cantidadRestante: { gt: 0 } },
      orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }],
    }),
    prisma.lineaPedido.groupBy({
      by: ['articuloId'],
      where: { pedido: { almacenId, estado: 'CONFIRMADO' } },
      _sum: { cantidad: true },
    }),
  ]);

  return parametros.map((p) => {
    const propias = capas.filter((c) => c.articuloId === p.articuloId && c.almacenId === almacenId);
    const disponibles = propias.filter((c) => c.estado === 'DISPONIBLE');
    const fisico = disponibles.reduce((s, c) => s + c.cantidadRestante, 0);
    const cuarentena = propias.filter((c) => c.estado === 'CUARENTENA').reduce((s, c) => s + c.cantidadRestante, 0);
    const reservado = reservas.find((r) => r.articuloId === p.articuloId)?._sum.cantidad ?? 0;
    const enTransito = capas
      .filter((c) => c.articuloId === p.articuloId && c.almacenId === almacen.almacenTransitoId)
      .reduce((s, c) => s + c.cantidadRestante, 0);
    const disponible = fisico - reservado;
    const posicion = calcularPosicion(disponible, enTransito);
    const masAntigua = disponibles[0];
    return {
      articuloId: p.articuloId,
      codigo: p.articulo.codigo,
      descripcion: p.articulo.descripcion,
      claseAbc: p.claseAbc,
      disponible,
      reservado,
      cuarentena,
      stockTotal: disponible + reservado,
      enTransito,
      posicion,
      coberturaDias: cobertura(disponible, p.demandaDiaria),
      demandaDiaria: p.demandaDiaria,
      stockSeguridad: p.stockSeguridad,
      rop: p.rop,
      stockMaximo: p.stockMaximo,
      trasladoPropuesto: trasladoPropuesto(p.stockMaximo, posicion, p.rop),
      vidaRestanteDias: masAntigua ? vidaRestanteDias(masAntigua.fechaVencimiento, fechaOperacion) : null,
      costoFifo: masAntigua ? Number(masAntigua.costoUnitario) : null,
    };
  });
}
