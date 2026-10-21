// Comprueba la integridad del inventario en la base: capas vs. movimientos vs. estados del stock.
// Uso: npm run db:verificar (sale con código 1 si algo no cuadra).
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TIPOS_FISICOS } from '../src/inventario/calculos/formulas.js';
import { obtenerStock } from '../src/inventario/stock.js';

config({ path: '../.env', quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const errores: string[] = [];
  const [capas, movimientos, almacenes] = await Promise.all([
    prisma.capaFifo.findMany({ include: { articulo: true, almacen: true } }),
    prisma.movimiento.groupBy({ by: ['articuloId', 'almacenId', 'capaId'], where: { tipo: { in: [...TIPOS_FISICOS] } }, _sum: { cantidad: true } }),
    prisma.almacen.findMany(),
  ]);

  for (const c of capas) {
    const id = `capa ${c.id} (${c.articulo.codigo} ${c.almacen.codigo} ${c.lote})`;
    if (c.cantidadRestante < 0) errores.push(`${id}: cantidad restante negativa`);
    if (c.cantidadRestante > c.cantidadInicial) errores.push(`${id}: restante mayor que la inicial`);
    if (c.fechaVencimiento <= c.fechaElaboracion) errores.push(`${id}: vence antes de elaborarse`);
    if ((c.estado === 'AGOTADA') !== (c.cantidadRestante === 0)) errores.push(`${id}: estado ${c.estado} con restante ${c.cantidadRestante}`);
    const movs = movimientos.filter((m) => m.capaId === c.id).reduce((s, m) => s + (m._sum.cantidad ?? 0), 0);
    if (movs !== c.cantidadRestante) errores.push(`${id}: Σ movimientos ${movs} ≠ restante ${c.cantidadRestante}`);
  }

  // Por artículo y almacén: Σ capas = Σ movimientos físicos = disponible + reservado + cuarentena.
  const fecha = new Date('2027-06-30T00:00:00Z');
  let combinaciones = 0;
  for (const a of almacenes) {
    const stock = a.tipo === 'PLANTA' ? await obtenerStock(prisma, a.id, fecha) : [];
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

  if (errores.length) {
    console.error(`❌ ${errores.length} problemas de integridad:\n- ${errores.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Integridad OK: ${capas.length} capas, ${combinaciones} combinaciones artículo/almacén.`);
  }
}

main().finally(() => prisma.$disconnect());
