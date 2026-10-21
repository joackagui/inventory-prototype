// Ensayo de la demo por HTTP: pedido → despacho → traslado → conteo → ajuste → aprobación → cuarentena.
// Requiere el backend en marcha (npm run backend:dev). Vuelve a sembrar el escenario del 30/06/2027 antes de empezar,
// salvo con --sin-sembrar. Uso: npm run demo:api
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { sembrar } from '../prisma/seed.js';

config({ path: '../.env', quiet: true });
const API = process.env.API_URL ?? 'http://localhost:3000/api';
let fallos = 0;

async function api(usuario: string, metodo: string, ruta: string, cuerpo?: object) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-Usuario': usuario },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function paso<T>(n: number, titulo: string, esperado: number, accion: () => Promise<{ status: number; body: T }>, mostrar: (b: T) => string, alertas?: string) {
  const r = await accion();
  const ok = r.status === esperado;
  if (!ok) fallos++;
  console.log(`\n${ok ? '✅' : '❌'} ${n}. ${titulo}  [HTTP ${r.status}${ok ? '' : `, se esperaba ${esperado}`}]`);
  // Un error esperado (403/409) muestra su código y mensaje; uno inesperado, la respuesta completa.
  const error = r.body as { codigo?: string; mensaje?: string; detalles?: unknown };
  const texto = !ok ? JSON.stringify(r.body) : r.status >= 400 ? `${error.codigo}: ${error.mensaje} ${error.detalles ? JSON.stringify(error.detalles) : ''}` : mostrar(r.body);
  console.log(`   ${texto}`);
  if (alertas) console.log(`   🔔 Alertas esperadas: ${alertas}`);
  return r.body;
}

type Stock = { articulos: { codigo: string; disponible: number; reservado: number; enTransito: number; posicion: number; rop: number; vidaRestanteDias: number | null; cuarentena: number }[] };
const fila = (s: Stock, codigo: string) => s.articulos.find((a) => a.codigo === codigo)!;

async function main() {
  if (!process.argv.includes('--sin-sembrar')) {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    await sembrar(prisma, { silencioso: true });
    await prisma.$disconnect();
    console.log('🌱 Escenario del 30/06/2027 sembrado de nuevo.');
  }
  const salud = await fetch(`${API}/salud`).then((r) => r.json(), () => null);
  if (!salud) throw new Error(`El backend no responde en ${API}. Inícialo con: npm run backend:dev`);
  console.log(`🩺 Backend ${salud.estado}, base ${salud.baseDeDatos}, fecha simulada ${salud.fechaSimulada}`);

  await paso(1, 'Preventista PV-014 consulta disponibilidad en La Paz (sin costos)', 200, () => api('PV-014', 'GET', '/stock?almacenId=CD-LP-01'),
    (b: { articulos: { codigo: string; disponible: number; estado: string }[] }) => b.articulos.map((a) => `${a.codigo} ${a.estado} (${a.disponible})`).join(' · '));

  const pedido = await paso(2, 'PV-014 crea pedido de 300 cajas de ART-10021 para Cliente 001 (reserva)', 201,
    () => api('PV-014', 'POST', '/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 300 }] }),
    (b: { numero: string; estado: string }) => `${b.numero} ${b.estado}`, 'AL12 amarillo si no se despacha en 24 h');

  await paso(3, 'PV-014 pide 30 de ART-10048 (agotado)', 409,
    () => api('PV-014', 'POST', '/pedidos', { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10048', cantidad: 30 }] }),
    () => '', 'AL11 (pedido pendiente de revisión por falta de stock)');

  await paso(4, `ALM-LP despacha el pedido (FIFO)`, 200, () => api('ALM-LP', 'POST', `/pedidos/${(pedido as unknown as { id: number }).id}/despachar`),
    (b: { capasConsumidas: { lote: string; cantidad: number; costoUnitario: number }[]; costoTotal: number }) =>
      `${b.capasConsumidas.map((s) => `${s.cantidad} × ${s.costoUnitario} (lote ${s.lote})`).join(' + ')} = USD ${b.costoTotal}`);

  const propuesta = await paso(5, 'LOG-01 consulta la propuesta de traslados para La Paz', 200, () => api('LOG-01', 'GET', '/traslados/propuesta?almacenId=CD-LP-01'),
    (b: { articulo: string; trasladoPropuesto: number; origenSugerido: string | null; cantidadSugerida: number }[]) =>
      b.map((p) => `${p.articulo}: propuesto ${p.trasladoPropuesto}, origen ${p.origenSugerido ?? '—'} (${p.cantidadSugerida})`).join(' · '));
  const p10022 = (propuesta as { articulo: string; cantidadSugerida: number; origenSugerido: string }[]).find((p) => p.articulo === 'ART-10022')!;

  const orden = await paso(6, `LOG-01 emite traslado ${p10022.origenSugerido} → La Paz de ${p10022.cantidadSugerida} cajas de ART-10022`, 201,
    () => api('LOG-01', 'POST', '/traslados', { origen: p10022.origenSugerido, destino: 'CD-LP-01', lineas: [{ articulo: 'ART-10022', cantidad: p10022.cantidadSugerida }] }),
    (b: { numero: string; estado: string }) => `${b.numero} ${b.estado}`);
  const ordenId = (orden as unknown as { id: number }).id;

  await paso(7, 'ALM-SC despacha el traslado al tránsito', 200, () => api('ALM-SC', 'POST', `/traslados/${ordenId}/despachar`),
    (b: { estado: string }) => b.estado);
  const enRuta = (await api('LOG-01', 'GET', '/stock?almacenId=CD-LP-01')).body as Stock;
  const s22 = fila(enRuta, 'ART-10022');
  console.log(`   La Paz ART-10022: disponible ${s22.disponible}, en tránsito ${s22.enTransito}, posición ${s22.posicion} vs ROP ${s22.rop}`);
  console.log('   🔔 Alertas esperadas: AL01 de ART-10022 se apaga (posición > ROP); AL08 si no se recibe en L + 1 días');

  await paso(8, 'ALM-LP recibe 6 cajas menos de lo despachado', 200,
    () => api('ALM-LP', 'POST', `/traslados/${ordenId}/recibir`, { lineas: [{ articulo: 'ART-10022', cantidadRecibida: p10022.cantidadSugerida - 6, observacion: 'Faltan 6 cajas' }] }),
    (b: { estado: string; lineas: { cantidadDespachada: number; cantidadRecibida: number }[] }) => `${b.estado}: despachado ${b.lineas[0].cantidadDespachada}, recibido ${b.lineas[0].cantidadRecibida}`,
    'AL09 rojo (diferencia 6 / 236 = 2.5% > 1%)');

  const conteo = await paso(9, 'ALM-LP cuenta ART-30005 en PICK-B: 205 contra 210 del sistema', 201,
    () => api('ALM-LP', 'POST', '/conteos', { tipo: 'CICLICO', almacen: 'CD-LP-01', ubicacion: 'PICK-B', articulo: 'ART-30005', cantidadContada: 205 }),
    (b: { conteo: { diferencia: number; porcentaje: number; requiereRecuento: boolean }; ajuste: { id: number; estado: string } }) =>
      `diferencia ${b.conteo.diferencia} (${b.conteo.porcentaje}%), recuento ${b.conteo.requiereRecuento ? 'sí' : 'no'}; ajuste ${b.ajuste.id} ${b.ajuste.estado}`,
    'AL06 rojo (2.38% > 2%), AL07 mientras el ajuste esté pendiente; AL05 de ART-30005 se apaga (conteo de hoy)');
  const ajusteId = (conteo as { ajuste: { id: number } }).ajuste.id;

  await paso(10, 'ALM-LP (R06, quien lo registró) intenta aprobar el ajuste', 403, () => api('ALM-LP', 'POST', `/ajustes/${ajusteId}/aprobar`), () => '');
  await paso(11, 'LOG-01 aprueba el ajuste', 200, () => api('LOG-01', 'POST', `/ajustes/${ajusteId}/aprobar`),
    (b: { estado: string; valor: number }) => `${b.estado}, valor USD ${b.valor}`, 'AL07 se cierra');

  const capas = (await api('LOG-01', 'GET', '/articulos/ART-10063/capas')).body as { id: number; almacen: { codigo: string }; cantidadRestante: number; vidaRestanteDias: number; lote: string }[];
  const vieja = capas.find((c) => c.almacen.codigo === 'CD-LP-01' && c.vidaRestanteDias === 12)!;
  await paso(12, `ALM-LP pone en cuarentena la capa ${vieja.lote} de ART-10063 (${vieja.cantidadRestante} cajas, 12 días)`, 201,
    () => api('ALM-LP', 'POST', '/cuarentena', { capaId: vieja.id, cantidad: vieja.cantidadRestante, motivo: 'Vence en 12 días' }),
    (b: { estado: string; lote: string }) => `capa ${b.lote} ${b.estado}`, 'AL04 baja de rojo a amarillo (la capa vendible más antigua tiene 25 días)');

  await paso(13, 'TI-01 verifica la integridad', 200, () => api('TI-01', 'GET', '/integridad'),
    (b: { ok: boolean; capas: number; errores: string[] }) => (b.ok ? `OK (${b.capas} capas)` : `ERRORES: ${b.errores.join('; ')}`));

  const final = (await api('LOG-01', 'GET', '/stock?almacenId=CD-LP-01')).body as Stock;
  console.log('\n📦 Stock final de La Paz:');
  console.table(final.articulos.map((a) => ({ Artículo: a.codigo, Disponible: a.disponible, Reservado: a.reservado, Cuarentena: a.cuarentena, Tránsito: a.enTransito, ROP: a.rop, 'Vida rest.': a.vidaRestanteDias ?? '—' })));
  console.log(fallos ? `\n❌ ${fallos} paso(s) no dieron el resultado esperado.` : '\n✅ Demo completa sin sorpresas.');
  process.exitCode = fallos ? 1 : 0;
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exitCode = 1;
});
