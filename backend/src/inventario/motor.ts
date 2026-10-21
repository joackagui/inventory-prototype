// Motor de inventario: piezas reutilizables por todas las operaciones. Siempre se usan dentro de una transacción.
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorNegocio, noEncontrado } from '../comun/errores.js';
import { type CapaFifo, Prisma, type Articulo, type TipoMovimiento } from '../generated/prisma/client.js';

export type Tx = Prisma.TransactionClient;
export interface Par {
  articuloId: number;
  almacenId: number;
}
export interface Pieza {
  capa: CapaFifo;
  cantidad: number;
}

export const EVENTO_CAMBIO = 'inventario.cambio';
// Evaluación completa de alertas (cambio de fecha simulada, integración, umbrales).
export const EVENTO_EVALUAR = 'alertas.evaluar';
export const masDias = (f: Date, n: number) => new Date(f.getTime() + n * 86_400_000);
export const aFecha = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);

// Candado por artículo y almacén: SELECT … FOR UPDATE sobre su fila de parámetros, en orden de id para evitar interbloqueos.
// Toda operación que cambia el stock de un par lo toma primero; así dos peticiones simultáneas no venden el mismo stock.
// El stock en tránsito hacia un almacén se protege con el candado de ese almacén destino.
export async function bloquear(tx: Tx, pares: Par[]) {
  const unicos = [...new Map(pares.map((p) => [`${p.articuloId}:${p.almacenId}`, p])).values()];
  if (!unicos.length) return;
  const filas = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM "ParametroArticuloAlmacen"
    WHERE ("articuloId", "almacenId") IN (${Prisma.join(unicos.map((p) => Prisma.sql`(${p.articuloId}, ${p.almacenId})`))})
    ORDER BY id FOR UPDATE`;
  if (filas.length !== unicos.length) throw new ErrorNegocio(404, 'ARTICULO_NO_CONFIGURADO', 'El artículo no tiene parámetros en ese almacén');
}

// Saldo de un artículo en un almacén. vendible = capas DISPONIBLES con vida ≥ días mínimos − reservado.
export async function saldo(tx: Tx, par: Par, fecha: Date, diasMinimos: number) {
  // Secuencial: una transacción usa una sola conexión.
  const capas = await tx.capaFifo.findMany({ where: { ...par, estado: 'DISPONIBLE', cantidadRestante: { gt: 0 } } });
  const reservas = await tx.lineaPedido.aggregate({ where: { articuloId: par.articuloId, pedido: { almacenId: par.almacenId, estado: 'CONFIRMADO' } }, _sum: { cantidad: true } });
  const limite = masDias(fecha, diasMinimos);
  const fisico = capas.reduce((s, c) => s + c.cantidadRestante, 0);
  const despachable = capas.filter((c) => c.fechaVencimiento >= limite).reduce((s, c) => s + c.cantidadRestante, 0);
  const reservado = reservas._sum.cantidad ?? 0;
  return { fisico, reservado, disponible: fisico - reservado, vendible: despachable - reservado };
}

// Consume capas en orden FIFO (fechaEntrada, id). Sin capaId solo usa capas DISPONIBLES; con venceDesde salta las que vencen antes.
export async function consumir(
  tx: Tx,
  o: Par & { cantidad: number; venceDesde?: Date; capaId?: number; ordenTrasladoId?: number },
): Promise<Pieza[]> {
  const capas = await tx.capaFifo.findMany({
    where: {
      articuloId: o.articuloId,
      almacenId: o.almacenId,
      cantidadRestante: { gt: 0 },
      ...(o.capaId ? { id: o.capaId } : { estado: 'DISPONIBLE' }),
      ...(o.ordenTrasladoId ? { ordenTrasladoId: o.ordenTrasladoId } : {}),
      ...(o.venceDesde ? { fechaVencimiento: { gte: o.venceDesde } } : {}),
    },
    orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }],
  });
  let pendiente = o.cantidad;
  const piezas: Pieza[] = [];
  for (const capa of capas) {
    if (pendiente === 0) break;
    const n = Math.min(pendiente, capa.cantidadRestante);
    await tx.capaFifo.update({
      where: { id: capa.id },
      data: { cantidadRestante: capa.cantidadRestante - n, estado: capa.cantidadRestante === n ? 'AGOTADA' : capa.estado },
    });
    piezas.push({ capa, cantidad: n });
    pendiente -= n;
  }
  if (pendiente > 0) {
    throw new ErrorNegocio(409, 'STOCK_INSUFICIENTE', 'No hay stock suficiente en capas utilizables', { articuloId: o.articuloId, almacenId: o.almacenId, faltante: pendiente });
  }
  return piezas;
}

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  articuloId: number;
  almacenId: number;
  ubicacionId: number;
  capaId?: number | null;
  cantidad: number;
  costoUnitario: number | Prisma.Decimal;
  fechaOperacion: Date;
  usuarioId: number;
  motivo: string;
  documentoTipo?: string;
  documentoId?: number;
}

// Libro mayor: solo inserta. valor = cantidad × costo (con signo).
export function registrar(tx: Tx, movimientos: DatosMovimiento[]) {
  return tx.movimiento.createMany({
    data: movimientos.map((m) => ({ ...m, valor: Math.round(m.cantidad * Number(m.costoUnitario) * 100) / 100 })),
  });
}

// Capa nueva que conserva lote, costo, elaboración y vencimiento de la original.
export function copiarCapa(
  tx: Tx,
  origen: CapaFifo,
  d: { almacenId: number; ubicacionId: number; cantidad: number; fechaEntrada: Date; estado?: 'DISPONIBLE' | 'CUARENTENA'; ordenTrasladoId?: number | null },
) {
  return tx.capaFifo.create({
    data: {
      articuloId: origen.articuloId,
      lote: origen.lote,
      fechaElaboracion: origen.fechaElaboracion,
      fechaVencimiento: origen.fechaVencimiento,
      costoUnitario: origen.costoUnitario,
      almacenId: d.almacenId,
      ubicacionId: d.ubicacionId,
      fechaEntrada: d.fechaEntrada,
      cantidadInicial: d.cantidad,
      cantidadRestante: d.cantidad,
      estado: d.estado ?? 'DISPONIBLE',
      ordenTrasladoId: d.ordenTrasladoId ?? null,
    },
  });
}

export async function articuloPorCodigo(tx: Tx, codigo: string) {
  const articulo = await tx.articulo.findUnique({ where: { codigo } });
  if (!articulo) throw noEncontrado(`El artículo ${codigo}`);
  return articulo;
}

export async function almacenPlanta(tx: Tx, codigo: string) {
  const almacen = await tx.almacen.findUnique({ where: { codigo } });
  if (!almacen) throw noEncontrado(`El almacén ${codigo}`);
  if (almacen.tipo !== 'PLANTA') throw new ErrorNegocio(400, 'ALMACEN_INVALIDO', `${codigo} es un almacén de tránsito; no se opera directamente`);
  return almacen;
}

export async function ubicacion(tx: Tx, almacenId: number, codigo: string) {
  const u = await tx.ubicacion.findUnique({ where: { almacenId_codigo: { almacenId, codigo } } });
  if (!u) throw new ErrorNegocio(400, 'UBICACION_INVALIDA', `La ubicación ${codigo} no pertenece al almacén`);
  return u;
}

// PICK-A para cerveza retornable, PICK-B para latas, gaseosas y aguas.
export const ubicacionPicking = (tx: Tx, almacenId: number, articulo: Pick<Articulo, 'esRetornable'>) =>
  ubicacion(tx, almacenId, articulo.esRetornable ? 'PICK-A' : 'PICK-B');

// Se emite después de confirmar la transacción y se espera a los oyentes (alertas): la respuesta ya las refleja.
export async function emitirCambio(eventos: EventEmitter2, pares: Par[], operacion: string) {
  for (const p of new Map(pares.map((x) => [`${x.articuloId}:${x.almacenId}`, { articuloId: x.articuloId, almacenId: x.almacenId }])).values()) {
    await eventos.emitAsync(EVENTO_CAMBIO, { ...p, operacion });
  }
}

const r2 = (x: number) => Math.round(x * 100) / 100;

// Capas que salieron en una operación (para la respuesta y el panel de resultado).
export function resumenConsumo(piezas: Pieza[]) {
  const capasConsumidas = piezas.map((p) => ({
    capaId: p.capa.id,
    lote: p.capa.lote,
    cantidad: p.cantidad,
    costoUnitario: Number(p.capa.costoUnitario),
    valor: r2(p.cantidad * Number(p.capa.costoUnitario)),
    vencimiento: p.capa.fechaVencimiento.toISOString().slice(0, 10),
  }));
  return { capasConsumidas, costoTotal: r2(capasConsumidas.reduce((s, c) => s + c.valor, 0)) };
}

// Valor de un ajuste sin aplicarlo: una baja recorre las capas como consumir() (la indicada, las de su traslado o FIFO);
// un alta se valora al costo de la última capa. Lo usan la vista previa, la bandeja de aprobaciones y el detalle.
export async function valorarAjuste(tx: Tx, a: Par & { cantidad: number; capaId?: number | null; ordenTrasladoId?: number | null }) {
  if (a.cantidad > 0) {
    const ultima = await tx.capaFifo.findFirst({ where: { articuloId: a.articuloId, almacenId: a.almacenId }, orderBy: [{ fechaEntrada: 'desc' }, { id: 'desc' }] });
    const costo = ultima ? Number(ultima.costoUnitario) : Number((await tx.articulo.findUniqueOrThrow({ where: { id: a.articuloId } })).costoFifoInicial);
    return { valor: r2(a.cantidad * costo), capas: [{ lote: ultima?.lote ?? 'nueva', cantidad: a.cantidad, costoUnitario: costo }] };
  }
  const capas = await tx.capaFifo.findMany({
    where: {
      articuloId: a.articuloId,
      almacenId: a.almacenId,
      cantidadRestante: { gt: 0 },
      ...(a.capaId ? { id: a.capaId } : { estado: 'DISPONIBLE' }),
      ...(a.ordenTrasladoId ? { ordenTrasladoId: a.ordenTrasladoId } : {}),
    },
    orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }],
  });
  let pendiente = -a.cantidad;
  const usadas = [];
  for (const c of capas) {
    if (!pendiente) break;
    const n = Math.min(pendiente, c.cantidadRestante);
    usadas.push({ lote: c.lote, cantidad: n, costoUnitario: Number(c.costoUnitario) });
    pendiente -= n;
  }
  return { valor: -r2(usadas.reduce((s, u) => s + u.cantidad * u.costoUnitario, 0)), capas: usadas, faltante: pendiente };
}
