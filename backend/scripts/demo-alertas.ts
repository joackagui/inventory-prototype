// Ensayo de la demo de alertas por HTTP: estado base → despacho que dispara una alerta → recepción que la resuelve →
// avanzar la fecha (vencimientos) → escalamiento → falla de integración y reproceso.
// Requiere el backend en marcha (npm run backend:dev). Vuelve a sembrar el escenario, salvo con --sin-sembrar.
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { sembrar } from '../prisma/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '../.env', quiet: true });
const API = process.env.API_URL ?? 'http://localhost:3000/api';
let fallos = 0;

async function api(usuario: string, metodo: string, ruta: string, cuerpo?: object) {
  const res = await fetch(`${API}${ruta}`, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Usuario': usuario }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!res.ok) {
    fallos++;
    console.log(`   ❌ ${metodo} ${ruta} → HTTP ${res.status}: ${await res.text()}`);
    return null;
  }
  return res.json();
}

type Alerta = { id: number; codigo: string; color: string; estado: string; mensaje: string; nivelEscalamiento: number; almacen: { codigo: string } | null; articulo: { codigo: string } | null };
const vigentes = async () => ((await api('LOG-01', 'GET', '/alertas?tamano=500')).datos as Alerta[]).filter((a) => a.estado !== 'RESUELTA');
const emoji: Record<string, string> = { ROJO: '🔴', AMARILLO: '🟡', AZUL: '🔵' };
const linea = (a: Alerta) => `${emoji[a.color]} ${a.codigo} ${a.almacen?.codigo ?? 'SISTEMA'} ${a.articulo?.codigo ?? ''} — ${a.mensaje}${a.nivelEscalamiento ? ` [escalada nivel ${a.nivelEscalamiento}]` : ''}`;

async function contadores(titulo: string) {
  const r = await api('LOG-01', 'GET', '/alertas/resumen');
  console.log(`\n▶ ${titulo}`);
  console.log(`   ${r.fechaOperacion} · vigentes ${r.total} (🔴 ${r.porColor.ROJO} 🟡 ${r.porColor.AMARILLO} 🔵 ${r.porColor.AZUL}) · sin atender ${r.sinAtender} · escaladas ${r.escaladas}`);
}

async function main() {
  if (!process.argv.includes('--sin-sembrar')) {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    await sembrar(prisma, { silencioso: true });
    await prisma.$disconnect();
    console.log('🌱 Escenario del 30/06/2027 sembrado de nuevo (con sus alertas).');
  }
  if (!(await fetch(`${API}/salud`).then((r) => r.ok, () => false))) throw new Error(`El backend no responde en ${API}. Inícialo con: npm run backend:dev`);

  await contadores('1. Estado base');
  for (const a of await vigentes()) console.log(`   ${linea(a)}`);

  const pedido = await api('PV-014', 'POST', '/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 600 }] });
  await api('ALM-LP', 'POST', `/pedidos/${pedido.id}/despachar`);
  await contadores(`2. ALM-LP despacha ${pedido.numero}: 600 cajas de ART-10021`);
  const al01 = (await vigentes()).find((a) => a.codigo === 'AL01' && a.articulo?.codigo === 'ART-10021');
  console.log(al01 ? `   Nueva: ${linea(al01)}` : '   ❌ No apareció el AL01 esperado');
  if (!al01) fallos++;

  await api('ALM-LP', 'POST', '/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10021', cantidad: 700, costoUnitario: 12.7, lote: 'LP-10021-270629', fechaElaboracion: '2027-06-29' });
  await contadores('3. ALM-LP recibe 700 cajas de producción de ART-10021');
  if (al01) {
    const r = await api('LOG-01', 'GET', `/alertas/${al01.id}`);
    console.log(`   AL01 de ART-10021: ${r.estado} (${r.resultado})`);
  }

  const al02 = (await vigentes()).find((a) => a.codigo === 'AL02')!;
  await api('LOG-01', 'POST', `/alertas/${al02.id}/atender`, { resultado: 'Traslado urgente desde Cochabamba', comentario: 'Llega en 4 días' });
  await contadores('4. LOG-01 atiende el quiebre (AL02) de ART-10048');

  await api('TI-01', 'POST', '/simulacion/avanzar', { dias: 5 });
  await contadores('5. TI-01 avanza la fecha 5 días (05/07/2027)');
  for (const a of (await vigentes()).filter((x) => ['AL04', 'AL05', 'AL12'].includes(x.codigo))) console.log(`   ${linea(a)}`);

  console.log('\n▶ 6. Escalamiento: rojas sin atender por más de 24 h');
  for (const a of (await vigentes()).filter((x) => x.nivelEscalamiento > 0)) console.log(`   ${linea(a)}`);
  const quiebre = await api('LOG-01', 'GET', `/alertas/${al02.id}`);
  console.log(`   El quiebre atendido no escala: nivel ${quiebre.nivelEscalamiento}, ${quiebre.situacion}`);

  const evento = await api('TI-01', 'POST', '/simulacion/falla-integracion', { estado: 'COLA_ERRORES', tipo: 'CONCILIACION_VENTAS', referencia: 'Lote de facturas 05/07' });
  await contadores('7. Falla de integración simulada (cola de errores)');
  for (const a of (await vigentes()).filter((x) => x.codigo === 'AL16')) console.log(`   ${linea(a)}`);
  await api('TI-01', 'POST', `/integracion/eventos/${evento.id}/reprocesar`);
  await contadores('8. TI-01 reprocesa el evento');
  console.log(`   AL16 vigentes: ${(await vigentes()).filter((x) => x.codigo === 'AL16').length}`);

  await api('TI-01', 'POST', '/simulacion/restablecer');
  await contadores('9. Fecha restablecida al 30/06/2027');
  const integridad = await api('TI-01', 'GET', '/integridad');
  console.log(`\n${integridad?.ok ? '✅ Integridad OK' : '❌ Integridad con errores'} · ${fallos ? `❌ ${fallos} paso(s) fallaron` : '✅ Demo de alertas completa'}`);
  process.exitCode = fallos || !integridad?.ok ? 1 : 0;
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exitCode = 1;
});
