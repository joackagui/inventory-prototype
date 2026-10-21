// Verificación de integridad del inventario. La usan `npm run db:verificar`, GET /api/integridad y los tests.
import type { PrismaClient } from '../generated/prisma/client.js';
import { TIPOS_FISICOS } from './calculos/formulas.js';
import { obtenerStock } from './stock.js';

export async function verificarIntegridad(prisma: PrismaClient, fechaOperacion: Date) {
  const errores: string[] = [];
  const [capas, movimientos, almacenes] = await Promise.all([
    prisma.capaFifo.findMany({ include: { articulo: true, almacen: true } }),
    prisma.movimiento.groupBy({ by: ['articuloId', 'almacenId', 'capaId'], where: { tipo: { in: [...TIPOS_FISICOS] } }, _sum: { cantidad: true } }),
    prisma.almacen.findMany(),
  ]);

  const porCapa = new Map<number, number>();
  for (const m of movimientos) if (m.capaId) porCapa.set(m.capaId, (porCapa.get(m.capaId) ?? 0) + (m._sum.cantidad ?? 0));
  for (const c of capas) {
    const id = `capa ${c.id} (${c.articulo.codigo} ${c.almacen.codigo} ${c.lote})`;
    if (c.cantidadRestante < 0) errores.push(`${id}: cantidad restante negativa`);
    if (c.cantidadRestante > c.cantidadInicial) errores.push(`${id}: restante mayor que la inicial`);
    if (c.fechaVencimiento <= c.fechaElaboracion) errores.push(`${id}: vence antes de elaborarse`);
    if ((c.estado === 'AGOTADA') !== (c.cantidadRestante === 0)) errores.push(`${id}: estado ${c.estado} con restante ${c.cantidadRestante}`);
    const movs = porCapa.get(c.id) ?? 0;
    if (movs !== c.cantidadRestante) errores.push(`${id}: Σ movimientos ${movs} ≠ restante ${c.cantidadRestante}`);
  }

  // Un lote identifica una sola producción: mismo lote ⇒ mismo costo, elaboración y vencimiento.
  const porLote = new Map<string, (typeof capas)[number]>();
  for (const c of capas) {
    const clave = `${c.articuloId}/${c.lote}`;
    const otra = porLote.get(clave);
    if (!otra) porLote.set(clave, c);
    else if (Number(otra.costoUnitario) !== Number(c.costoUnitario) || otra.fechaVencimiento.getTime() !== c.fechaVencimiento.getTime()) {
      errores.push(`lote ${c.lote} (${c.articulo.codigo}): capas ${otra.id} y ${c.id} con costo o vencimiento distintos`);
    }
  }

  // Por artículo y almacén: Σ capas = Σ movimientos físicos = disponible + reservado + cuarentena.
  let combinaciones = 0;
  for (const a of almacenes) {
    const stock = a.tipo === 'PLANTA' ? await obtenerStock(prisma, a.id, fechaOperacion) : [];
    const articulos = new Set([...capas.filter((c) => c.almacenId === a.id).map((c) => c.articuloId), ...stock.map((s) => s.articuloId)]);
    for (const articuloId of articulos) {
      combinaciones++;
      const sumaCapas = capas.filter((c) => c.almacenId === a.id && c.articuloId === articuloId).reduce((s, c) => s + c.cantidadRestante, 0);
      const sumaMovs = movimientos.filter((m) => m.almacenId === a.id && m.articuloId === articuloId).reduce((s, m) => s + (m._sum.cantidad ?? 0), 0);
      if (sumaCapas !== sumaMovs) errores.push(`${a.codigo}/${articuloId}: Σ capas ${sumaCapas} ≠ Σ movimientos ${sumaMovs}`);
      const s = stock.find((x) => x.articuloId === articuloId);
      if (s) {
        if (s.disponible + s.reservado + s.cuarentena !== sumaCapas) errores.push(`${a.codigo}/${s.codigo}: disponible + reservado + cuarentena ≠ Σ capas`);
        if (s.disponible < 0) errores.push(`${a.codigo}/${s.codigo}: disponible negativo (reservado mayor que el stock)`);
      }
    }
  }
  return { ok: errores.length === 0, capas: capas.length, combinaciones, errores };
}
