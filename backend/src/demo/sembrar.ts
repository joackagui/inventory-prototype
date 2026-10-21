// Seed determinista del escenario de demo al 30/06/2027 (sección 12 de docs/ESPECIFICACION.md).
// Idempotente: vacía todas las tablas y vuelve a sembrar. Los valores elegidos para CB y SC están en docs/MODELO_DATOS.md.
// Lo ejecuta `npm run db:seed` (prisma/seed.ts), lo importan los tests y lo usa POST /api/simulacion/restablecer-datos.
import { PrismaClient, type TipoMovimiento } from '../generated/prisma/client.js';
import { calcularParametros, clasificarAbc, type ClaseAbc, type ParametrosCalculados } from '../inventario/calculos/formulas.js';
import { evaluarAlertas } from '../alertas/evaluacion.js';
import { obtenerStock } from '../inventario/stock.js';
import { esDiaDespacho } from '../comun/calendario.js';

// ---------- Utilidades deterministas ----------
const SEMILLA = 20270630;
let semilla = SEMILLA;
function aleatorio() {
  // mulberry32
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const normal = () => Math.sqrt(-2 * Math.log(1 - aleatorio())) * Math.cos(2 * Math.PI * aleatorio());
const F = (s: string) => new Date(`${s}T00:00:00Z`);
const masDias = (f: Date, n: number) => new Date(f.getTime() + n * 86_400_000);
const yymmdd = (f: Date) => f.toISOString().slice(2, 10).replaceAll('-', '');
const r2 = (x: number) => Math.round(x * 100) / 100;

const FECHA_OPERACION = F('2027-06-30');
// 90 días de despacho (lunes a sábado, sin feriados) hasta el día anterior a la fecha de operación.
const DIAS: Date[] = [];
for (let f = masDias(FECHA_OPERACION, -1); DIAS.length < 90; f = masDias(f, -1)) {
  if (esDiaDespacho(f)) DIAS.unshift(f);
}
const N = DIAS.length;
const indiceDia = (s: string) => DIAS.findIndex((d) => d.getTime() === F(s).getTime());

// ---------- Datos maestros ----------
const ALMACENES = [
  { codigo: 'CD-LP-01', corto: 'LP', nombre: 'Planta y CD La Paz', leadTime: 3, factorD: 1, factorSigma: 1 },
  { codigo: 'CD-CB-01', corto: 'CB', nombre: 'Planta y CD Cochabamba', leadTime: 4, factorD: 0.67, factorSigma: 0.86 },
  { codigo: 'CD-SC-01', corto: 'SC', nombre: 'Planta y CD Santa Cruz', leadTime: 3, factorD: 1.08, factorSigma: 1 },
];
const UBICACIONES = [
  { codigo: 'PICK-A', descripcion: 'Picking cerveza retornable', vendible: true },
  { codigo: 'PICK-B', descripcion: 'Picking latas, gaseosas y aguas', vendible: true },
  { codigo: 'ENV-RET', descripcion: 'Envases devueltos', vendible: false },
  { codigo: 'MUELLE-01', descripcion: 'Muelle de carga', vendible: true },
  { codigo: 'CUAR-01', descripcion: 'Cuarentena (vencido, dañado o en revisión)', vendible: false },
];
const ARTICULOS = [
  { codigo: 'ART-10021', descripcion: 'Paceña 620 ml retornable · caja x12', familia: 'CERVEZA', unidad: 'caja x12', precio: 18.7, d: 120, sigma: 17, vida: 180, costo: 12.4, retornable: true },
  { codigo: 'ART-10022', descripcion: 'Paceña lata 354 ml · caja x24', familia: 'CERVEZA', unidad: 'caja x24', precio: 21.9, d: 70, sigma: 10, vida: 270, costo: 14.5, retornable: false },
  { codigo: 'ART-10035', descripcion: 'Huari 620 ml retornable · caja x12', familia: 'CERVEZA', unidad: 'caja x12', precio: 21.4, d: 45, sigma: 6.5, vida: 180, costo: 14.1, retornable: true },
  { codigo: 'ART-10048', descripcion: 'Taquiña 620 ml retornable · caja x12', familia: 'CERVEZA', unidad: 'caja x12', precio: 18.2, d: 35, sigma: 5, vida: 180, costo: 12.1, retornable: true },
  { codigo: 'ART-20011', descripcion: 'Pepsi 2 L · pack x6', familia: 'GASEOSA', unidad: 'pack x6', precio: 7.8, d: 60, sigma: 8.5, vida: 120, costo: 5.2, retornable: false },
  { codigo: 'ART-10063', descripcion: 'Bock 620 ml retornable · caja x12', familia: 'CERVEZA', unidad: 'caja x12', precio: 19.3, d: 20, sigma: 3, vida: 180, costo: 12.8, retornable: true },
  { codigo: 'ART-30005', descripcion: 'Agua Vital 2 L · pack x6', familia: 'AGUA', unidad: 'pack x6', precio: 4.6, d: 25, sigma: 4, vida: 365, costo: 3.1, retornable: false },
];

// Escenario objetivo: disponible, reservado y vida restante (días) de la capa más antigua.
// La Paz = tabla de la sección 12. CB y SC: elegidos para mezclar estados (ver docs/MODELO_DATOS.md).
// `capas` fija explícitamente las capas finales (de la más antigua a la más nueva).
type Objetivo = { disponible: number; reservado?: number; vida?: number; capas?: { cantidad: number; vida: number }[]; esperado: string };
const ESCENARIO: Record<string, Record<string, Objetivo>> = {
  LP: {
    'ART-10021': { disponible: 920, reservado: 160, vida: 137, esperado: 'Normal' },
    'ART-10022': { disponible: 240, vida: 214, esperado: 'AL01 amarillo (traslado 496)' },
    'ART-10035': { disponible: 20, vida: 96, esperado: 'AL01 rojo' },
    'ART-10048': { disponible: 0, esperado: 'AL02 quiebre' },
    'ART-20011': { disponible: 700, reservado: 40, vida: 58, esperado: 'AL03 exceso (azul)' },
    // 40 cajas a 12 días (no se despachan: < 15) y 110 a 25 días (en liquidación).
    'ART-10063': { disponible: 150, capas: [{ cantidad: 40, vida: 12 }, { cantidad: 110, vida: 25 }], esperado: 'AL04 rojo (capa de 40 vence en 12 días)' },
    'ART-30005': { disponible: 210, vida: 301, esperado: 'AL05 amarillo (conteo hace 185 días)' },
  },
  CB: {
    'ART-10021': { disponible: 640, reservado: 120, esperado: 'Normal' },
    'ART-10022': { disponible: 200, esperado: 'AL01 amarillo' },
    'ART-10035': { disponible: 90, esperado: 'Normal + AL08 (traslado SC→CB atrasado)' },
    'ART-10048': { disponible: 200, esperado: 'Normal' },
    'ART-20011': { disponible: 600, esperado: 'AL03 exceso (azul) + AL06 (conteo −4)' },
    'ART-10063': { disponible: 150, esperado: 'Normal' },
    'ART-30005': { disponible: 200, esperado: 'Normal' },
  },
  SC: {
    'ART-10021': { disponible: 950, reservado: 140, esperado: 'Normal' },
    'ART-10022': { disponible: 500, esperado: 'Normal' },
    'ART-10035': { disponible: 300, esperado: 'Normal' },
    'ART-10048': { disponible: 100, esperado: 'AL01 amarillo' },
    'ART-20011': { disponible: 400, esperado: 'Normal' },
    'ART-10063': { disponible: 200, esperado: 'Normal' },
    'ART-30005': { disponible: 600, esperado: 'AL03 exceso (azul)' },
  },
};
// Traslado en tránsito atrasado: SC → CB, despachado el 23/06 (7 días; L de CB = 4 → supera L + 2).
const TRASLADO = { origen: 'SC', destino: 'CB', articulo: 'ART-10035', cantidad: 210, emision: '2027-06-22', despacho: '2027-06-23' };

const ULTIMO_CONTEO: Record<ClaseAbc, string> = { A: '2027-06-10', B: '2027-05-15', C: '2027-03-10' };
const ULTIMO_CONTEO_ESPECIAL: Record<string, string> = {
  'LP:ART-30005': '2026-12-27', // 185 días antes del 30/06/2027
  'CB:ART-20011': '2027-06-30', // conteo de hoy con diferencia, genera el ajuste pendiente
};

const USUARIOS = [
  { codigo: 'PV-014', nombre: 'Preventista', rol: 'R01' },
  { codigo: 'SUP-01', nombre: 'Supervisor de ventas', rol: 'R02' },
  { codigo: 'AST-01', nombre: 'Asistente de pedidos', rol: 'R03' },
  { codigo: 'ALM-LP', nombre: 'Encargado de almacén La Paz', rol: 'R06', almacen: 'CD-LP-01' },
  { codigo: 'ALM-CB', nombre: 'Encargado de almacén Cochabamba', rol: 'R06', almacen: 'CD-CB-01' },
  { codigo: 'ALM-SC', nombre: 'Encargado de almacén Santa Cruz', rol: 'R06', almacen: 'CD-SC-01' },
  { codigo: 'LOG-01', nombre: 'Coordinador de logística', rol: 'R07' },
  { codigo: 'GER-01', nombre: 'Gerencia', rol: 'R08' },
  { codigo: 'TI-01', nombre: 'Administrador de sistemas', rol: 'R09' },
];
const ROLES = [
  { codigo: 'R01', nombre: 'Preventista', descripcion: 'Consulta disponibilidad y crea pedidos simulados (reserva). No ve costos ni alertas.' },
  { codigo: 'R02', nombre: 'Supervisor de ventas', descripcion: 'Propone promociones y consulta envases sin devolver.' },
  { codigo: 'R03', nombre: 'Asistente de pedidos', descripcion: 'Revisa pedidos pendientes por falta de stock (atiende AL11) y consulta.' },
  { codigo: 'R06', nombre: 'Almacén', descripcion: 'Opera solo su almacén: recibe, despacha, cuenta y registra ajustes (no los aprueba).' },
  { codigo: 'R07', nombre: 'Coordinador de logística', descripcion: 'Los 3 almacenes. Fija parámetros y aprueba traslados, ajustes y mermas.' },
  { codigo: 'R08', nombre: 'Gerencia', descripcion: 'Consulta el tablero y los costos.' },
  { codigo: 'R09', nombre: 'Administrador', descripcion: 'Usuarios, registro de cambios y reproceso de eventos.' },
];

const TODAS = ALMACENES.map((a) => a.codigo);
const FIESTAS = [
  { nombre: 'Año Nuevo', inicio: '2027-12-31', fin: '2028-01-01', dias: 2, zonas: TODAS, factor: 1.7, semanas: 8 },
  { nombre: 'Carnaval', inicio: '2027-02-06', fin: '2027-02-09', dias: 4, zonas: TODAS, factor: 1.6, semanas: 6 },
  { nombre: 'Día del Padre', inicio: '2027-03-19', fin: '2027-03-19', dias: 1, zonas: TODAS, factor: 1.2, semanas: 3 },
  { nombre: 'Gran Poder', inicio: '2027-05-22', fin: '2027-05-22', dias: 1, zonas: ['CD-LP-01'], factor: 1.5, semanas: 6 },
  { nombre: 'Día de la Madre', inicio: '2027-05-27', fin: '2027-05-27', dias: 1, zonas: TODAS, factor: 1.2, semanas: 3 },
  { nombre: 'Año Nuevo Andino y San Juan', inicio: '2027-06-21', fin: '2027-06-24', dias: 4, zonas: ['CD-LP-01', 'CD-CB-01'], factor: 1.3, semanas: 4 },
  { nombre: 'Aniversario de La Paz y Día de la Patria', inicio: '2027-07-16', fin: '2027-08-06', dias: 2, zonas: TODAS, factor: 1.3, semanas: 4 },
  { nombre: 'Urkupiña', inicio: '2027-08-14', fin: '2027-08-16', dias: 3, zonas: ['CD-CB-01'], factor: 1.6, semanas: 6 },
  { nombre: 'Aniversarios de Cochabamba y Santa Cruz', inicio: '2027-09-14', fin: '2027-09-24', dias: 2, zonas: ['CD-CB-01', 'CD-SC-01'], factor: 1.3, semanas: 4 },
  { nombre: 'Navidad', inicio: '2027-12-24', fin: '2027-12-25', dias: 2, zonas: TODAS, factor: 1.7, semanas: 8 },
];

// ---------- Simulación FIFO del historial ----------
interface CapaSim {
  id?: number;
  articulo: string;
  almacen: string;
  ubicacion: string;
  lote: string;
  fechaEntrada: Date;
  fechaElaboracion: Date;
  fechaVencimiento: Date;
  cantidadInicial: number;
  cantidadRestante: number;
  costo: number;
  enTransito?: boolean;
}
interface MovSim {
  tipo: TipoMovimiento;
  articulo: string;
  almacen: string;
  ubicacion: string;
  capa: CapaSim | null;
  cantidad: number;
  costo: number;
  fecha: Date;
  usuario: string;
  motivo: string;
  documentoTipo?: string;
  documentoId?: number;
}
let capas: CapaSim[] = [];
let movimientos: MovSim[] = [];

function consumirFifo(propias: CapaSim[], cantidad: number, alConsumir: (capa: CapaSim, n: number) => void) {
  for (const capa of propias) {
    if (cantidad === 0) break;
    const n = Math.min(capa.cantidadRestante, cantidad);
    if (n === 0) continue;
    capa.cantidadRestante -= n;
    cantidad -= n;
    alConsumir(capa, n);
  }
  if (cantidad > 0) throw new Error('Simulación FIFO: stock insuficiente');
}

// Construye entradas y salidas para que el saldo final y las capas restantes coincidan exactamente con el objetivo.
// Reposición demorada (días hábiles del historial) en artículos que ya tienen alertas en el estado base.
const EXCEPCIONES: Record<string, [number, number]> = { 'LP:ART-10035': [40, 49], 'LP:ART-10048': [55, 66] };

function simular(alm: (typeof ALMACENES)[number], art: (typeof ARTICULOS)[number], clase: ClaseAbc, d: number, sigma: number, p: ParametrosCalculados, obj: Objetivo) {
  const usuario = `ALM-${alm.corto}`;
  const ubicacion = art.retornable ? 'PICK-A' : 'PICK-B';
  const total = obj.disponible + (obj.reservado ?? 0);

  const ventas = DIAS.map(() => Math.max(0, Math.round(d + sigma * normal())));
  if (total === 0) for (let t = N - 4; t < N; t++) ventas[t] = 0; // quiebre: los últimos días no hubo qué vender
  const traslado = alm.corto === TRASLADO.origen && art.codigo === TRASLADO.articulo ? { t: indiceDia(TRASLADO.despacho), n: TRASLADO.cantidad } : null;
  const salida = (t: number) => ventas[t] + (traslado?.t === t ? traslado.n : 0);

  // Capas finales: la más antigua con la vida restante objetivo; las nuevas, +10 días de vida y +1% de costo cada una.
  const k = total === 0 ? 0 : clase === 'A' ? (total >= 300 ? 3 : 2) : total >= 300 ? 2 : 1;
  const vidaBase = obj.vida ?? Math.round(art.vida * 0.6);
  const definicion =
    obj.capas ??
    Array.from({ length: k }, (_, i) => ({
      cantidad: i === 0 ? total - (k - 1) * Math.floor(total / k) : Math.floor(total / k),
      vida: vidaBase + 10 * i,
    }));
  if (definicion.reduce((s, c) => s + c.cantidad, 0) !== total) throw new Error(`Capas definidas no suman el stock de ${art.codigo}`);
  const finales = definicion.map((c, i) => ({
    t: N - 2 - 3 * (definicion.length - 1 - i),
    restante: c.cantidad,
    vencimiento: masDias(FECHA_OPERACION, c.vida),
    costo: r2(art.costo * (1 + 0.01 * i)),
  }));
  const t1 = finales.length ? finales[0].t : N;
  let salidaDesdeT1 = 0;
  for (let t = t1; t < N; t++) salidaDesdeT1 += salida(t);
  // Stock con que llega el día t1 (antes de las capas finales): debe consumirse entero después para que las capas cuadren.
  const colchon = finales.length ? Math.min(p.rop + d, salidaDesdeT1) : 0;

  // Historial sano antes de t1: se repone el lote Q cuando el stock no cubre ROP + d; las ventas no superan el stock.
  const excepcion = EXCEPCIONES[`${alm.corto}:${art.codigo}`];
  const previas: { t: number; cantidad: number }[] = [];
  let stock = 0;
  for (let t = 0; t < t1; t++) {
    const fija = traslado?.t === t ? traslado.n : 0;
    const demorada = excepcion && t >= excepcion[0] && t <= excepcion[1];
    if (t === 0 || stock < fija || (!demorada && stock - fija <= p.rop + d)) {
      const cantidad = t === 0 ? p.stockMaximo : p.loteTraslado + fija;
      previas.push({ t, cantidad });
      stock += cantidad;
    }
    ventas[t] = Math.min(ventas[t], stock - fija);
    stock -= ventas[t] + fija;
  }
  // Ajuste exacto: las últimas entradas se recortan (o la última se agranda) para llegar a t1 con el colchón.
  // Después de la última entrada el stock solo baja, así que nunca queda negativo.
  let delta = colchon - stock;
  while (delta < 0 && previas.length) {
    const ultima = previas.at(-1)!;
    if (ultima.cantidad + delta > 0) {
      ultima.cantidad += delta;
      delta = 0;
    } else {
      delta += ultima.cantidad;
      previas.pop();
    }
  }
  if (delta > 0) previas.at(-1)!.cantidad += delta;
  const entradas = new Map<number, Omit<CapaSim, 'articulo' | 'almacen' | 'ubicacion' | 'fechaEntrada'>>();
  // Lote único por artículo y almacén: los de las capas finales quedan limpios; un histórico que coincida lleva sufijo.
  const loteDe = (elaboracion: Date) => `${alm.corto}-${art.codigo.slice(4)}-${yymmdd(elaboracion)}`;
  const usados = new Set(finales.map((f) => loteDe(masDias(f.vencimiento, -art.vida))));
  const loteHistorico = (elaboracion: Date) => {
    let lote = loteDe(elaboracion);
    for (let n = 2; usados.has(lote); n++) lote = `${loteDe(elaboracion)}-${n}`;
    usados.add(lote);
    return lote;
  };
  previas.forEach(({ t, cantidad }, j) => {
    const elaboracion = masDias(DIAS[t], -3);
    entradas.set(t, {
      lote: loteHistorico(elaboracion),
      fechaElaboracion: elaboracion,
      fechaVencimiento: masDias(elaboracion, art.vida),
      cantidadInicial: cantidad,
      cantidadRestante: cantidad,
      costo: r2(art.costo * (0.97 + (0.03 * j) / previas.length)),
    });
  });
  finales.forEach((f, i) => {
    const elaboracion = masDias(f.vencimiento, -art.vida);
    if (elaboracion > DIAS[f.t]) throw new Error(`Capa elaborada después de su entrada: ${art.codigo} ${alm.corto}`);
    const inicial = f.restante + (i === 0 ? salidaDesdeT1 - colchon : 0);
    entradas.set(f.t, {
      lote: loteDe(elaboracion),
      fechaElaboracion: elaboracion,
      fechaVencimiento: f.vencimiento,
      cantidadInicial: inicial,
      cantidadRestante: inicial,
      costo: f.costo,
    });
  });

  const propias: CapaSim[] = [];
  const saldoDiario: number[] = [];
  let saldo = 0;
  const piezasTraslado: { capa: CapaSim; n: number }[] = [];
  for (let t = 0; t < N; t++) {
    const e = entradas.get(t);
    if (e) {
      const capa: CapaSim = { ...e, articulo: art.codigo, almacen: alm.codigo, ubicacion, fechaEntrada: DIAS[t] };
      propias.push(capa);
      capas.push(capa);
      saldo += capa.cantidadInicial;
      movimientos.push({ tipo: 'ENTRADA', articulo: art.codigo, almacen: alm.codigo, ubicacion, capa, cantidad: capa.cantidadInicial, costo: capa.costo, fecha: DIAS[t], usuario, motivo: 'Producción de planta', documentoTipo: 'HISTORICO' });
    }
    consumirFifo(propias, ventas[t], (capa, n) =>
      movimientos.push({ tipo: 'SALIDA', articulo: art.codigo, almacen: alm.codigo, ubicacion, capa, cantidad: -n, costo: capa.costo, fecha: DIAS[t], usuario, motivo: 'Venta preventa', documentoTipo: 'HISTORICO' }),
    );
    if (traslado?.t === t) {
      consumirFifo(propias, traslado.n, (capa, n) => {
        piezasTraslado.push({ capa, n });
        movimientos.push({ tipo: 'TRASLADO_SALIDA', articulo: art.codigo, almacen: alm.codigo, ubicacion, capa, cantidad: -n, costo: capa.costo, fecha: DIAS[t], usuario, motivo: 'Traslado entre plantas', documentoTipo: 'OrdenTraslado' });
      });
    }
    saldo -= salida(t);
    saldoDiario.push(saldo);
  }

  // Comprobación: el FIFO dejó exactamente las capas finales objetivo.
  const restantes = propias.filter((c) => c.cantidadRestante > 0).map((c) => c.cantidadRestante);
  if (saldo !== total || restantes.join() !== finales.map((f) => f.restante).join()) {
    throw new Error(`El historial no cuadra para ${art.codigo} en ${alm.corto}: ${restantes} vs ${finales.map((f) => f.restante)}`);
  }
  return { saldoDiario, piezasTraslado };
}

export async function sembrar(prisma: PrismaClient, { silencioso = false } = {}) {
  semilla = SEMILLA;
  capas = [];
  movimientos = [];
  // Vaciar todo (TRUNCATE no dispara el trigger de inmutabilidad, que es por fila).
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);

  // Almacenes, tránsitos y ubicaciones
  const almacenId: Record<string, number> = {};
  const ubicacionId: Record<string, number> = {}; // clave "CD-LP-01/PICK-A"
  for (const a of ALMACENES) {
    const tr = await prisma.almacen.create({
      data: { codigo: `TR-${a.corto}`, nombre: `Tránsito hacia ${a.nombre}`, tipo: 'TRANSITO', ubicaciones: { create: { codigo: 'EN-RUTA', descripcion: 'Mercadería en camino', vendible: false } } },
      include: { ubicaciones: true },
    });
    const planta = await prisma.almacen.create({
      data: { codigo: a.codigo, nombre: a.nombre, leadTimeDias: a.leadTime, almacenTransitoId: tr.id, ubicaciones: { create: UBICACIONES } },
      include: { ubicaciones: true },
    });
    for (const x of [tr, planta]) {
      almacenId[x.codigo] = x.id;
      for (const u of x.ubicaciones) ubicacionId[`${x.codigo}/${u.codigo}`] = u.id;
    }
  }

  await prisma.rol.createMany({ data: ROLES });
  const usuarioId: Record<string, number> = {};
  for (const u of USUARIOS) {
    const creado = await prisma.usuario.create({ data: { codigo: u.codigo, nombre: u.nombre, rolCodigo: u.rol, almacenId: u.almacen ? almacenId[u.almacen] : null } });
    usuarioId[u.codigo] = creado.id;
  }

  const clienteId: Record<string, number> = {};
  for (let i = 1; i <= 4; i++) {
    const codigo = `Cliente ${String(i).padStart(3, '0')}`;
    clienteId[codigo] = (await prisma.cliente.create({ data: { codigo, nombre: codigo } })).id;
  }

  // Artículos; la clase ABC se calcula con la demanda de La Paz.
  const clases = new Map(clasificarAbc(ARTICULOS.map((a) => ({ codigo: a.codigo, precio: a.precio, demandaDiaria: a.d }))).map((r) => [r.codigo, r.clase]));
  const articuloId: Record<string, number> = {};
  for (const a of ARTICULOS) {
    const creado = await prisma.articulo.create({
      data: { codigo: a.codigo, descripcion: a.descripcion, familia: a.familia, unidad: a.unidad, precio: a.precio, vidaUtilDias: a.vida, costoFifoInicial: a.costo, esRetornable: a.retornable },
    });
    articuloId[a.codigo] = creado.id;
  }

  // Parámetros por artículo y almacén + historial simulado
  const saldos: Record<string, number[]> = {};
  let piezasTraslado: { capa: CapaSim; n: number }[] = [];
  for (const alm of ALMACENES) {
    for (const art of ARTICULOS) {
      const clase = clases.get(art.codigo)!;
      const d = Math.round(art.d * alm.factorD);
      const sigma = r2(art.sigma * alm.factorSigma);
      const p = calcularParametros(d, sigma, alm.leadTime, clase);
      const clave = `${alm.corto}:${art.codigo}`;
      await prisma.parametroArticuloAlmacen.create({
        data: {
          articuloId: articuloId[art.codigo],
          almacenId: almacenId[alm.codigo],
          demandaDiaria: d,
          desviacionDemanda: sigma,
          leadTimeDias: alm.leadTime,
          claseAbc: clase,
          ...p,
          ultimoConteo: F(ULTIMO_CONTEO_ESPECIAL[clave] ?? ULTIMO_CONTEO[clase]),
        },
      });
      const r = simular(alm, art, clase, d, sigma, p, ESCENARIO[alm.corto][art.codigo]);
      saldos[clave] = r.saldoDiario;
      if (r.piezasTraslado.length) piezasTraslado = r.piezasTraslado;
    }
  }

  // Traslado en tránsito: las capas viajan (mismo lote, costo y vencimiento) al almacén de tránsito del destino.
  const destino = ALMACENES.find((a) => a.corto === TRASLADO.destino)!;
  const origen = ALMACENES.find((a) => a.corto === TRASLADO.origen)!;
  for (const { capa, n } of piezasTraslado) {
    const enRuta: CapaSim = { ...capa, almacen: `TR-${destino.corto}`, ubicacion: 'EN-RUTA', fechaEntrada: F(TRASLADO.despacho), cantidadInicial: n, cantidadRestante: n, id: undefined, enTransito: true };
    capas.push(enRuta);
    movimientos.push({ tipo: 'TRASLADO_ENTRADA', articulo: capa.articulo, almacen: enRuta.almacen, ubicacion: 'EN-RUTA', capa: enRuta, cantidad: n, costo: capa.costo, fecha: F(TRASLADO.despacho), usuario: `ALM-${origen.corto}`, motivo: 'Traslado entre plantas', documentoTipo: 'OrdenTraslado' });
  }
  const orden = await prisma.ordenTraslado.create({
    data: {
      numero: 'OT-2027-0001',
      origenId: almacenId[origen.codigo],
      destinoId: almacenId[destino.codigo],
      estado: 'EN_TRANSITO',
      fechaEmision: F(TRASLADO.emision),
      fechaDespacho: F(TRASLADO.despacho),
      usuarioId: usuarioId['LOG-01'],
      lineas: { create: { articuloId: articuloId[TRASLADO.articulo], cantidadDespachada: TRASLADO.cantidad } },
    },
  });

  for (const c of capas) {
    const creada = await prisma.capaFifo.create({
      data: {
        articuloId: articuloId[c.articulo],
        almacenId: almacenId[c.almacen],
        ubicacionId: ubicacionId[`${c.almacen}/${c.ubicacion}`],
        lote: c.lote,
        fechaEntrada: c.fechaEntrada,
        fechaElaboracion: c.fechaElaboracion,
        fechaVencimiento: c.fechaVencimiento,
        cantidadInicial: c.cantidadInicial,
        cantidadRestante: c.cantidadRestante,
        costoUnitario: c.costo,
        estado: c.cantidadRestante > 0 ? 'DISPONIBLE' : 'AGOTADA',
        ordenTrasladoId: c.enTransito ? orden.id : null,
      },
    });
    c.id = creada.id;
  }

  // Pedidos simulados confirmados (reservas)
  const PEDIDOS = [
    { cliente: 'Cliente 001', almacen: 'CD-LP-01', articulo: 'ART-10021', cantidad: 100 },
    { cliente: 'Cliente 002', almacen: 'CD-LP-01', articulo: 'ART-10021', cantidad: 60 },
    { cliente: 'Cliente 003', almacen: 'CD-LP-01', articulo: 'ART-20011', cantidad: 40 },
    { cliente: 'Cliente 004', almacen: 'CD-CB-01', articulo: 'ART-10021', cantidad: 120 },
    { cliente: 'Cliente 001', almacen: 'CD-SC-01', articulo: 'ART-10021', cantidad: 140 },
  ];
  for (const [i, p] of PEDIDOS.entries()) {
    const pedido = await prisma.pedidoSimulado.create({
      data: {
        numero: `PS-${String(i + 1).padStart(4, '0')}`,
        clienteId: clienteId[p.cliente],
        almacenId: almacenId[p.almacen],
        estado: 'CONFIRMADO',
        fechaOperacion: FECHA_OPERACION,
        usuarioId: usuarioId['PV-014'],
        lineas: { create: { articuloId: articuloId[p.articulo], cantidad: p.cantidad } },
      },
    });
    const ubic = ARTICULOS.find((a) => a.codigo === p.articulo)!.retornable ? 'PICK-A' : 'PICK-B';
    movimientos.push({ tipo: 'RESERVA', articulo: p.articulo, almacen: p.almacen, ubicacion: ubic, capa: null, cantidad: p.cantidad, costo: 0, fecha: FECHA_OPERACION, usuario: 'PV-014', motivo: `Reserva pedido ${pedido.numero}`, documentoTipo: 'PedidoSimulado', documentoId: pedido.id });
  }

  // Envases retornables en poder de clientes (Cliente 003 con más de 60 días)
  const ENVASES = [
    { cliente: 'Cliente 001', articulo: 'ART-10021', entregada: 120, devuelta: 80, fecha: '2027-06-20' },
    { cliente: 'Cliente 002', articulo: 'ART-10035', entregada: 60, devuelta: 0, fecha: '2027-05-20' },
    { cliente: 'Cliente 003', articulo: 'ART-10021', entregada: 200, devuelta: 150, fecha: '2027-04-15' },
    { cliente: 'Cliente 004', articulo: 'ART-10063', entregada: 40, devuelta: 10, fecha: '2027-06-25' },
  ];
  for (const e of ENVASES) {
    await prisma.saldoEnvase.create({
      data: { clienteId: clienteId[e.cliente], articuloId: articuloId[e.articulo], almacenId: almacenId['CD-LP-01'], cantidadEntregada: e.entregada, cantidadDevuelta: e.devuelta, fechaEntrega: F(e.fecha) },
    });
    movimientos.push({ tipo: 'ENVASE_ENTREGA', articulo: e.articulo, almacen: 'CD-LP-01', ubicacion: 'ENV-RET', capa: null, cantidad: -e.entregada, costo: 0, fecha: F(e.fecha), usuario: 'ALM-LP', motivo: `Envases entregados a ${e.cliente}` });
    if (e.devuelta) {
      movimientos.push({ tipo: 'ENVASE_DEVOLUCION', articulo: e.articulo, almacen: 'CD-LP-01', ubicacion: 'ENV-RET', capa: null, cantidad: e.devuelta, costo: 0, fecha: FECHA_OPERACION, usuario: 'ALM-LP', motivo: `Envases devueltos por ${e.cliente}` });
    }
  }

  // Último conteo de cada artículo y almacén (sin diferencia, salvo CB/ART-20011)
  for (const alm of ALMACENES) {
    for (const art of ARTICULOS) {
      const clave = `${alm.corto}:${art.codigo}`;
      const fecha = F(ULTIMO_CONTEO_ESPECIAL[clave] ?? ULTIMO_CONTEO[clases.get(art.codigo)!]);
      const t = DIAS.findLastIndex((d) => d <= fecha);
      // shortcut: un conteo anterior al historial usa el saldo del primer día; basta mientras no haya kardex previo.
      const sistema = fecha >= FECHA_OPERACION ? saldos[clave][N - 1] : saldos[clave][Math.max(t, 0)];
      const contada = clave === 'CB:ART-20011' ? sistema - 4 : sistema;
      const conteo = await prisma.conteoFisico.create({
        data: {
          tipo: 'CICLICO',
          articuloId: articuloId[art.codigo],
          almacenId: almacenId[alm.codigo],
          ubicacionId: ubicacionId[`${alm.codigo}/${art.retornable ? 'PICK-A' : 'PICK-B'}`],
          cantidadSistema: sistema,
          cantidadContada: contada,
          diferencia: contada - sistema,
          porcentaje: sistema ? r2((Math.abs(contada - sistema) / sistema) * 100) : 0,
          usuarioId: usuarioId[`ALM-${alm.corto}`],
          fechaOperacion: fecha,
        },
      });
      if (contada !== sistema) {
        await prisma.ajusteInventario.create({
          data: {
            articuloId: articuloId[art.codigo],
            almacenId: almacenId[alm.codigo],
            ubicacionId: conteo.ubicacionId,
            motivo: 'DIFERENCIA_CONTEO',
            cantidad: contada - sistema,
            observacion: 'Diferencia del conteo cíclico de hoy',
            conteoId: conteo.id,
            registradoPorId: usuarioId['ALM-CB'],
            fechaRegistro: FECHA_OPERACION,
          },
        });
      }
    }
  }
  // Ajuste pendiente de más de 24 h
  await prisma.ajusteInventario.create({
    data: {
      articuloId: articuloId['ART-10063'],
      almacenId: almacenId['CD-LP-01'],
      ubicacionId: ubicacionId['CD-LP-01/PICK-A'],
      motivo: 'ROTURA',
      cantidad: -6,
      observacion: 'Cajas rotas al descargar en muelle',
      registradoPorId: usuarioId['ALM-LP'],
      // 28/06: 48 h simuladas al 30/06, más de 24 h (AL07 amarillo).
      fechaRegistro: F('2027-06-28'),
    },
  });

  // Movimientos (libro mayor)
  for (let i = 0; i < movimientos.length; i += 1000) {
    await prisma.movimiento.createMany({
      data: movimientos.slice(i, i + 1000).map((m) => ({
        tipo: m.tipo,
        articuloId: articuloId[m.articulo],
        almacenId: almacenId[m.almacen],
        ubicacionId: ubicacionId[`${m.almacen}/${m.ubicacion}`],
        capaId: m.capa?.id ?? null,
        cantidad: m.cantidad,
        costoUnitario: m.costo,
        valor: r2(m.cantidad * m.costo),
        fechaOperacion: m.fecha,
        usuarioId: usuarioId[m.usuario],
        motivo: m.motivo,
        documentoTipo: m.documentoTipo ?? null,
        documentoId: m.documentoId ?? (m.documentoTipo === 'OrdenTraslado' ? orden.id : null),
      })),
    });
  }

  // La liquidación aplica solo a la capa de 25 días (15 a 30 días de vida); la de 12 días ya no se despacha.
  const capaLiquidacion = capas.find((c) => c.almacen === 'CD-LP-01' && c.articulo === 'ART-10063' && c.cantidadRestante === 110)!;
  await prisma.promocion.create({
    data: {
      nombre: 'Liquidación Bock por vencimiento',
      tipo: 'LIQUIDACION_VENCIMIENTO',
      articuloId: articuloId['ART-10063'],
      almacenId: almacenId['CD-LP-01'],
      capaId: capaLiquidacion.id,
      fechaInicio: FECHA_OPERACION,
      fechaFin: F('2027-07-12'),
      topeCajas: 110,
      descuentoPct: 30,
      estado: 'ACTIVA',
    },
  });

  await prisma.fiesta.createMany({
    data: FIESTAS.map((f) => ({ nombre: f.nombre, fechaInicio: F(f.inicio), fechaFin: F(f.fin), diasFiesta: f.dias, zonas: f.zonas, factor: f.factor, semanasPreparacion: f.semanas })),
  });

  await prisma.configuracionSistema.createMany({
    data: [
      { clave: 'fechaSimulada', valor: '2027-06-30', descripcion: 'Fecha de operación simulada (AAAA-MM-DD)' },
      { clave: 'costoPorTraslado', valor: 180, descripcion: 'Costo de pedido: USD por traslado' },
      { clave: 'tasaConservacionAnual', valor: 0.15, descripcion: 'Tasa anual de conservación sobre el valor del stock promedio' },
      { clave: 'tasaAgotamiento', valor: 0.015, descripcion: 'Fracción de pedidos no atendidos por falta de stock' },
      { clave: 'valorPedidoAgotamiento', valor: 40, descripcion: 'Valor promedio de un pedido no atendido (USD)' },
      { clave: 'margenAgotamiento', valor: 0.3, descripcion: 'Margen perdido por pedido no atendido (costo de agotamiento = valor × margen)' },
      { clave: 'toleranciaConteoPct', valor: 0.5, descripcion: 'Tolerancia de diferencia de conteo (% del saldo)' },
      { clave: 'diasMinimosVidaDespacho', valor: 15, descripcion: 'No se despacha con menos de estos días de vida restante' },
      {
        clave: 'umbralesAlertas',
        descripcion: 'Umbrales editables de las alertas AL01–AL16 (sección 8)',
        valor: {
          AL03: { rojoMultiploMax: 2 },
          AL04: { amarilloDias: 30, rojoDias: 15 },
          AL05: { frecuenciaDias: { A: 30, B: 90, C: 180 }, rojoDiasExtra: 7 },
          AL06: { amarilloPct: 0.5, rojoPct: 2 },
          AL07: { amarilloHoras: 24, rojoHoras: 48 },
          AL08: { amarilloDiasExtra: 1, rojoDiasExtra: 2 },
          AL09: { rojoPct: 1 },
          AL10: { amarilloDias: 30, rojoDias: 60 },
          AL11: { amarilloHoras: 2, rojoHoras: 24 },
          AL12: { amarilloHoras: 24, rojoHoras: 48 },
          AL13: { amarilloPct: 10, rojoPct: 15 },
          AL14: { amarilloDias: 21, rojoDias: 7 },
        },
      },
    ],
  });

  // Alertas del estado base, con el mismo motor que usa la API.
  const alertas = await evaluarAlertas(prisma);
  if (silencioso) return;
  // Tabla de verificación de La Paz, calculada con la misma función que usa GET /api/stock.
  const stockLp = await obtenerStock(prisma, almacenId['CD-LP-01'], FECHA_OPERACION);
  console.log(`\nSeed listo: ${capas.length} capas, ${movimientos.length} movimientos, ${N} días hábiles (${DIAS[0].toISOString().slice(0, 10)} → ${DIAS[N - 1].toISOString().slice(0, 10)}).`);
  console.log('Escenario La Paz al 30/06/2027:');
  console.table(
    stockLp.map((s) => ({
      Artículo: s.codigo,
      Disponible: s.disponible,
      Reservado: s.reservado,
      Tránsito: s.enTransito,
      ROP: s.rop,
      SS: s.stockSeguridad,
      Máx: s.stockMaximo,
      'Vida rest.': s.vidaRestanteDias ?? '—',
      Traslado: s.trasladoPropuesto,
      'Estado esperado': ESCENARIO.LP[s.codigo].esperado,
    })),
  );
  console.log(`Alertas abiertas en el estado base: ${alertas.abiertas}.`);
}
