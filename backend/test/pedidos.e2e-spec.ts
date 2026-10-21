import { capasDe, type Como, esperarIntegridad, iniciar, stockDe } from './utilidades.js';
import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTO_CAMBIO } from '../src/inventario/motor.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Pedidos, reservas y despacho FIFO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('1. reserva, despacha con FIFO y toma el costo de varias capas (ART-10021 LP)', async () => {
    const capas = await capasDe(prisma, 'ART-10021', 'CD-LP-01');
    expect(capas.map((c) => [c.cantidadRestante, Number(c.costoUnitario)])).toEqual([[360, 12.4], [360, 12.52], [360, 12.65]]);

    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 500 }] });
    expect(p.status).toBe(201);
    expect(p.body.estado).toBe('CONFIRMADO');
    expect(await stockDe(como, 'CD-LP-01', 'ART-10021')).toMatchObject({ disponible: 420, reservado: 660 });

    const d = await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    expect(d.status).toBe(200);
    expect(d.body.capasConsumidas.map((s: { cantidad: number; costoUnitario: number }) => [s.cantidad, s.costoUnitario])).toEqual([[360, 12.4], [140, 12.52]]);
    expect(d.body.costoTotal).toBe(6216.8); // 360 × 12.40 + 140 × 12.52
    expect((await capasDe(prisma, 'ART-10021', 'CD-LP-01')).map((c) => c.cantidadRestante)).toEqual([220, 360]);
    expect(await stockDe(como, 'CD-LP-01', 'ART-10021')).toMatchObject({ disponible: 420, reservado: 160 });
    const movs = await prisma.movimiento.findMany({ where: { documentoTipo: 'PedidoSimulado', documentoId: p.body.id, tipo: 'SALIDA' } });
    expect(movs.map((m) => Number(m.valor))).toEqual([-4464, -1752.8]);

    // Un pedido despachado no se vuelve a despachar.
    expect((await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`)).status).toBe(409);
  });

  it('2. sin stock suficiente responde 409 con el faltante y no deja reservas parciales', async () => {
    const antes = await stockDe(como, 'CD-LP-01', 'ART-10022');
    const r = await como('PV-014').post('/pedidos', {
      cliente: 'Cliente 002',
      almacen: 'CD-LP-01',
      lineas: [{ articulo: 'ART-10022', cantidad: 100 }, { articulo: 'ART-10048', cantidad: 5 }],
    });
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe('STOCK_INSUFICIENTE');
    expect(r.body.detalles.faltantes).toEqual([{ articulo: 'ART-10048', solicitado: 5, disponible: 0, faltante: 5 }]);
    const pedido = await prisma.pedidoSimulado.findUniqueOrThrow({ where: { id: r.body.detalles.pedidoId } });
    expect(pedido.estado).toBe('PENDIENTE_REVISION');
    expect(await stockDe(como, 'CD-LP-01', 'ART-10022')).toMatchObject({ disponible: antes.disponible, reservado: antes.reservado });
    expect(await prisma.movimiento.count({ where: { tipo: 'RESERVA', documentoId: pedido.id } })).toBe(0);
  });

  it('3. concurrencia: dos pedidos simultáneos por el último stock, solo uno reserva', async () => {
    // ART-10035 LP: 20 disponibles.
    const pedir = () => como('PV-014').post('/pedidos', { cliente: 'Cliente 003', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10035', cantidad: 15 }] });
    const resultados = await Promise.all([pedir(), pedir()]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockDe(como, 'CD-LP-01', 'ART-10035')).toMatchObject({ disponible: 5, reservado: 15 });
  });

  it('4. el despacho salta la capa de 12 días del ART-10063 y usa la de 25', async () => {
    const [vieja, nueva] = await capasDe(prisma, 'ART-10063', 'CD-LP-01');
    expect([vieja.cantidadRestante, nueva.cantidadRestante]).toEqual([40, 110]);
    // Solo 110 son vendibles: 120 no se pueden reservar.
    expect((await como('PV-014').post('/pedidos', { cliente: 'Cliente 004', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10063', cantidad: 120 }] })).status).toBe(409);
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 004', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10063', cantidad: 50 }] });
    expect(p.status).toBe(201);
    const d = await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    expect(d.body.capasConsumidas).toEqual([expect.objectContaining({ capaId: nueva.id, cantidad: 50 })]);
    const despues = await capasDe(prisma, 'ART-10063', 'CD-LP-01');
    expect(despues.map((c) => c.cantidadRestante)).toEqual([40, 60]);
  });

  it('emite "inventario.cambio" con almacén y artículo solo tras confirmar la operación', async () => {
    const eventos: unknown[] = [];
    const emisor = app.get(EventEmitter2);
    const oyente = (e: unknown) => eventos.push(e);
    emisor.on(EVENTO_CAMBIO, oyente);
    const art = await prisma.articulo.findUniqueOrThrow({ where: { codigo: 'ART-30005' } });
    const alm = await prisma.almacen.findUniqueOrThrow({ where: { codigo: 'CD-LP-01' } });
    await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-30005', cantidad: 5 }] });
    expect(eventos).toEqual([{ articuloId: art.id, almacenId: alm.id, operacion: 'reserva' }]);
    // Una operación que falla (sin permiso) no emite.
    await como('PV-014').post('/operaciones/recepcion', {});
    expect(eventos).toHaveLength(1);
    emisor.off(EVENTO_CAMBIO, oyente);
  });

  it('cancelar libera la reserva', async () => {
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-30005', cantidad: 10 }] });
    expect((await stockDe(como, 'CD-LP-01', 'ART-30005')).reservado).toBe(15);
    const c = await como('PV-014').post(`/pedidos/${p.body.id}/cancelar`);
    expect(c.body.estado).toBe('CANCELADO');
    expect((await stockDe(como, 'CD-LP-01', 'ART-30005')).reservado).toBe(5);
  });

  it('bonificación en especie: requiere promoción vigente, sale con costo FIFO y motivo "promoción"', async () => {
    const linea = { articulo: 'ART-20011', cantidad: 12, bonificacion: true };
    const sinPromo = await como('PV-014').post('/pedidos', { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [linea] });
    expect(sinPromo.status).toBe(409);
    expect(sinPromo.body.codigo).toBe('SIN_PROMOCION');

    const articulo = await prisma.articulo.findUniqueOrThrow({ where: { codigo: 'ART-20011' } });
    const promo = await prisma.promocion.create({
      data: { nombre: 'Pack de regalo', tipo: 'BONIFICACION', articuloId: articulo.id, fechaInicio: new Date('2027-06-01'), fechaFin: new Date('2027-07-31'), topeCajas: 20, estado: 'ACTIVA' },
    });
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-20011', cantidad: 30 }, linea] });
    expect(p.status).toBe(201);
    expect((await prisma.promocion.findUniqueOrThrow({ where: { id: promo.id } })).cajasUsadas).toBe(12);
    // El tope restante (8) no alcanza para otras 12.
    expect((await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [linea] })).body.codigo).toBe('TOPE_PROMOCION');

    await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    const bonif = await prisma.movimiento.findMany({ where: { documentoId: p.body.id, documentoTipo: 'PedidoSimulado', tipo: 'BONIFICACION' } });
    expect(bonif.reduce((s, m) => s + m.cantidad, 0)).toBe(-12);
    expect(bonif.every((m) => m.motivo === 'promoción' && Number(m.costoUnitario) > 0)).toBe(true);
  });

  it('recepción de producción: capa con vencimiento = elaboración + vida útil; valida ubicación y costo', async () => {
    const base = { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10048', cantidad: 300, costoUnitario: 12.2, lote: 'LP-10048-270629', fechaElaboracion: '2027-06-29' };
    const r = await como('ALM-LP').post('/operaciones/recepcion', base);
    expect(r.status).toBe(201);
    expect(r.body.fechaVencimiento.slice(0, 10)).toBe('2027-12-26'); // 29/06 + 180 días
    expect(await stockDe(como, 'CD-LP-01', 'ART-10048')).toMatchObject({ disponible: 300 });
    expect((await como('ALM-LP').post('/operaciones/recepcion', { ...base, ubicacion: 'NO-EXISTE' })).body.codigo).toBe('UBICACION_INVALIDA');
    expect((await como('ALM-LP').post('/operaciones/recepcion', { ...base, costoUnitario: 0 })).status).toBe(400);
    expect((await como('ALM-LP').post('/operaciones/recepcion', { ...base, almacen: 'CD-CB-01' })).body.codigo).toBe('ALMACEN_AJENO');
  });
});
