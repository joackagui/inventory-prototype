// Verificación de integridad del inventario. La usan `npm run db:verificar`, GET /api/integridad, el restablecimiento
// de la demo y los tests. Devuelve el detalle de cada comprobación y, por compatibilidad, la lista plana de errores.
import type { PrismaClient } from '../generated/prisma/client.js';
import { TIPOS_FISICOS } from './calculos/formulas.js';
import { obtenerStock } from './stock.js';

export interface Comprobacion {
  nombre: string;
  ok: boolean;
  revisados: number;
  excepciones: string[];
  ms: number;
}

export async function verificarIntegridad(prisma: PrismaClient, fechaOperacion: Date) {
  const comprobaciones: Comprobacion[] = [];
  const comprobar = async (nombre: string, revisar: () => Promise<{ revisados: number; excepciones: string[] }>) => {
    const inicio = performance.now();
    const r = await revisar();
    comprobaciones.push({ nombre, ok: r.excepciones.length === 0, revisados: r.revisados, excepciones: r.excepciones, ms: Math.round(performance.now() - inicio) });
  };

  const [capas, movimientos, almacenes] = await Promise.all([
    prisma.capaFifo.findMany({ include: { articulo: true, almacen: true } }),
    prisma.movimiento.groupBy({ by: ['articuloId', 'almacenId', 'capaId'], where: { tipo: { in: [...TIPOS_FISICOS] } }, _sum: { cantidad: true } }),
    prisma.almacen.findMany(),
  ]);
  const etiqueta = (c: (typeof capas)[number]) => `capa ${c.id} (${c.articulo.codigo} ${c.almacen.codigo} ${c.lote})`;
  const stockPorAlmacen = new Map<number, Awaited<ReturnType<typeof obtenerStock>>>();
  for (const a of almacenes.filter((x) => x.tipo === 'PLANTA')) stockPorAlmacen.set(a.id, await obtenerStock(prisma, a.id, fechaOperacion));

  // Por artículo y almacén: Σ capas = Σ movimientos físicos; y en cada capa, Σ de sus movimientos = su saldo.
  await comprobar('Σ capas = Σ movimientos por artículo y almacén', async () => {
    const excepciones: string[] = [];
    const porCapa = new Map<number, number>();
    for (const m of movimientos) if (m.capaId) porCapa.set(m.capaId, (porCapa.get(m.capaId) ?? 0) + (m._sum.cantidad ?? 0));
    for (const c of capas) {
      const movs = porCapa.get(c.id) ?? 0;
      if (movs !== c.cantidadRestante) excepciones.push(`${etiqueta(c)}: Σ movimientos ${movs} ≠ restante ${c.cantidadRestante}`);
    }
    let pares = 0;
    for (const a of almacenes) {
      const articulos = new Set([...capas.filter((c) => c.almacenId === a.id).map((c) => c.articuloId), ...(stockPorAlmacen.get(a.id) ?? []).map((s) => s.articuloId)]);
      for (const articuloId of articulos) {
        pares++;
        const sumaCapas = capas.filter((c) => c.almacenId === a.id && c.articuloId === articuloId).reduce((s, c) => s + c.cantidadRestante, 0);
        const sumaMovs = movimientos.filter((m) => m.almacenId === a.id && m.articuloId === articuloId).reduce((s, m) => s + (m._sum.cantidad ?? 0), 0);
        if (sumaCapas !== sumaMovs) excepciones.push(`${a.codigo}/${articuloId}: Σ capas ${sumaCapas} ≠ Σ movimientos ${sumaMovs}`);
        const s = stockPorAlmacen.get(a.id)?.find((x) => x.articuloId === articuloId);
        if (s && s.disponible + s.reservado + s.cuarentena !== sumaCapas) excepciones.push(`${a.codigo}/${s.codigo}: disponible + reservado + cuarentena ≠ Σ capas`);
      }
    }
    return { revisados: pares, excepciones };
  });

  await comprobar('Ninguna capa con saldo negativo o inconsistente', async () => ({
    revisados: capas.length,
    excepciones: capas.flatMap((c) => [
      ...(c.cantidadRestante < 0 ? [`${etiqueta(c)}: cantidad restante negativa`] : []),
      ...(c.cantidadRestante > c.cantidadInicial ? [`${etiqueta(c)}: restante mayor que la inicial`] : []),
      ...((c.estado === 'AGOTADA') !== (c.cantidadRestante === 0) ? [`${etiqueta(c)}: estado ${c.estado} con restante ${c.cantidadRestante}`] : []),
    ]),
  }));

  await comprobar('Vencimiento posterior a la elaboración', async () => ({
    revisados: capas.length,
    excepciones: capas.filter((c) => c.fechaVencimiento <= c.fechaElaboracion).map((c) => `${etiqueta(c)}: vence antes de elaborarse`),
  }));

  // Un lote identifica una sola producción: mismo lote ⇒ mismo costo y vencimiento.
  await comprobar('Un lote, un solo costo y vencimiento', async () => {
    const excepciones: string[] = [];
    const porLote = new Map<string, (typeof capas)[number]>();
    for (const c of capas) {
      const clave = `${c.articuloId}/${c.lote}`;
      const otra = porLote.get(clave);
      if (!otra) porLote.set(clave, c);
      else if (Number(otra.costoUnitario) !== Number(c.costoUnitario) || otra.fechaVencimiento.getTime() !== c.fechaVencimiento.getTime()) {
        excepciones.push(`lote ${c.lote} (${c.articulo.codigo}): capas ${otra.id} y ${c.id} con costo o vencimiento distintos`);
      }
    }
    return { revisados: porLote.size, excepciones };
  });

  // El libro mayor es inmutable porque el trigger de PostgreSQL rechaza UPDATE y DELETE.
  await comprobar('Movimientos inmutables (trigger activo)', async () => {
    const [t] = await prisma.$queryRaw<{ activo: string }[]>`SELECT tgenabled::text AS activo FROM pg_trigger WHERE tgname = 'movimiento_inmutable'`;
    const total = await prisma.movimiento.count();
    return { revisados: total, excepciones: !t ? ['El trigger movimiento_inmutable no existe'] : t.activo === 'D' ? ['El trigger movimiento_inmutable está desactivado'] : [] };
  });

  // Reservado = Σ líneas de pedidos CONFIRMADOS, y nunca mayor que el stock físico.
  await comprobar('Reservado = Σ reservas vigentes', async () => {
    const reservas = await prisma.lineaPedido.findMany({ where: { pedido: { estado: 'CONFIRMADO' } }, include: { pedido: true } });
    const excepciones: string[] = [];
    let revisados = 0;
    for (const [almacenId, stock] of stockPorAlmacen) {
      for (const s of stock) {
        revisados++;
        const suma = reservas.filter((l) => l.pedido.almacenId === almacenId && l.articuloId === s.articuloId).reduce((t, l) => t + l.cantidad, 0);
        const codigo = almacenes.find((a) => a.id === almacenId)!.codigo;
        if (suma !== s.reservado) excepciones.push(`${codigo}/${s.codigo}: reservado ${s.reservado} ≠ Σ reservas ${suma}`);
        if (s.disponible < 0) excepciones.push(`${codigo}/${s.codigo}: disponible negativo (reservado mayor que el stock)`);
      }
    }
    return { revisados, excepciones };
  });

  const errores = comprobaciones.flatMap((c) => c.excepciones);
  const combinaciones = comprobaciones[0].revisados;
  return { ok: errores.length === 0, capas: capas.length, combinaciones, comprobaciones, errores };
}
