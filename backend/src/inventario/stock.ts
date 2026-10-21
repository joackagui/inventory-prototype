import { noEncontrado } from '../comun/errores.js';
import type { Tx } from './motor.js';
import {
  calcularPosicion,
  cobertura,
  trasladoPropuesto,
  vidaRestanteDias,
} from './calculos/formulas.js';

const MS_DIA = 86_400_000;

// Acepta el id numérico o el código ("CD-LP-01").
export async function resolverAlmacen(prisma: Tx, valor: string) {
  const almacen = await prisma.almacen.findUnique({
    where: /^\d+$/.test(valor) ? { id: Number(valor) } : { codigo: valor },
  });
  if (!almacen) throw noEncontrado(`El almacén ${valor}`);
  return almacen;
}

// Estados del stock por artículo en un almacén (sección 6). Stock total = disponible + reservado (+ cuarentena).
// vendible = lo que se puede reservar o despachar hoy: disponible sin las capas con menos de `diasMinimos` de vida.
export async function obtenerStock(
  prisma: Tx,
  almacenId: number,
  fechaOperacion: Date,
  diasMinimos = 15,
) {
  const almacen = await prisma.almacen.findUniqueOrThrow({
    where: { id: almacenId },
  });
  // Secuencial: también se usa dentro de transacciones (una sola conexión).
  const parametros = await prisma.parametroArticuloAlmacen.findMany({
    where: { almacenId },
    include: { articulo: true },
    orderBy: { articulo: { codigo: 'asc' } },
  });
  const capas = await prisma.capaFifo.findMany({
    where: {
      almacenId: { in: [almacenId, almacen.almacenTransitoId ?? -1] },
      cantidadRestante: { gt: 0 },
    },
    orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }],
  });
  const reservas = await prisma.lineaPedido.groupBy({
    by: ['articuloId'],
    where: { pedido: { almacenId, estado: 'CONFIRMADO' } },
    _sum: { cantidad: true },
  });

  return parametros.map((p) => {
    const propias = capas.filter(
      (c) => c.articuloId === p.articuloId && c.almacenId === almacenId,
    );
    const disponibles = propias.filter((c) => c.estado === 'DISPONIBLE');
    const fisico = disponibles.reduce((s, c) => s + c.cantidadRestante, 0);
    const cuarentena = propias
      .filter((c) => c.estado === 'CUARENTENA')
      .reduce((s, c) => s + c.cantidadRestante, 0);
    const reservado =
      reservas.find((r) => r.articuloId === p.articuloId)?._sum.cantidad ?? 0;
    const enTransito = capas
      .filter(
        (c) =>
          c.articuloId === p.articuloId &&
          c.almacenId === almacen.almacenTransitoId,
      )
      .reduce((s, c) => s + c.cantidadRestante, 0);
    const disponible = fisico - reservado;
    const limite = fechaOperacion.getTime() + diasMinimos * MS_DIA;
    const despachable = disponibles
      .filter((c) => c.fechaVencimiento.getTime() >= limite)
      .reduce((s, c) => s + c.cantidadRestante, 0);
    const posicion = calcularPosicion(disponible, enTransito);
    const masAntigua = disponibles[0];
    return {
      articuloId: p.articuloId,
      codigo: p.articulo.codigo,
      descripcion: p.articulo.descripcion,
      claseAbc: p.claseAbc,
      disponible,
      vendible: despachable - reservado,
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
      vidaRestanteDias: masAntigua
        ? vidaRestanteDias(masAntigua.fechaVencimiento, fechaOperacion)
        : null,
      costoFifo: masAntigua ? Number(masAntigua.costoUnitario) : null,
    };
  });
}
