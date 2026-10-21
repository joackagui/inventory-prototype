import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { capasDe, type Como, esperarIntegridad, iniciar, stockDe } from './utilidades.js';

describe('Cuarentena y envases', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('7. cuarentena parcial divide la capa, no se despacha y al liberar vuelve', async () => {
    const [vieja] = await capasDe(prisma, 'ART-10021', 'CD-LP-01');
    const q = await como('ALM-LP').post('/cuarentena', { capaId: vieja.id, cantidad: 100, motivo: 'Envases dañados' });
    expect(q.status).toBe(201);
    expect(q.body).toMatchObject({ estado: 'CUARENTENA', lote: vieja.lote, cantidadRestante: 100, costoUnitario: 12.4 });
    expect(q.body.fechaVencimiento).toBe(vieja.fechaVencimiento.toISOString());
    expect((await prisma.capaFifo.findUniqueOrThrow({ where: { id: vieja.id } })).cantidadRestante).toBe(260);
    expect(await stockDe(como, 'CD-LP-01', 'ART-10021')).toMatchObject({ disponible: 820, reservado: 160, cuarentena: 100 });

    // No se vende: 821 no alcanzan.
    expect((await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 821 }] })).status).toBe(409);
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 300 }] });
    const d = await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    expect(d.body.salidas.map((s: { capaId: number }) => s.capaId)).not.toContain(q.body.id);
    expect((await prisma.capaFifo.findUniqueOrThrow({ where: { id: q.body.id } })).cantidadRestante).toBe(100);

    expect((await como('ALM-LP').post(`/cuarentena/${q.body.id}/liberar`)).status).toBe(403);
    const lib = await como('LOG-01').post(`/cuarentena/${q.body.id}/liberar`);
    expect(lib.body).toMatchObject({ estado: 'DISPONIBLE', cantidadRestante: 100 });
    expect(await stockDe(como, 'CD-LP-01', 'ART-10021')).toMatchObject({ cuarentena: 0, disponible: 620 });
    expect((await como('LOG-01').post(`/cuarentena/${q.body.id}/liberar`)).body.codigo).toBe('CAPA_NO_EN_CUARENTENA');
  });

  it('7. capa completa a cuarentena y luego a merma por vencimiento', async () => {
    const [vieja] = await capasDe(prisma, 'ART-10063', 'CD-LP-01'); // 40 cajas, 12 días
    await como('ALM-LP').post('/cuarentena', { capaId: vieja.id, cantidad: 40, motivo: 'Vence en 12 días' });
    expect((await prisma.capaFifo.findUniqueOrThrow({ where: { id: vieja.id } })).estado).toBe('CUARENTENA');
    const merma = await como('ALM-LP').post('/ajustes', { almacen: 'CD-LP-01', articulo: 'ART-10063', cantidad: -40, motivo: 'VENCIMIENTO', capaId: vieja.id });
    const ok = await como('LOG-01').post(`/ajustes/${merma.body.id}/aprobar`);
    expect(ok.body.valor).toBe(-512); // 40 × 12.80
    expect((await prisma.capaFifo.findUniqueOrThrow({ where: { id: vieja.id } })).estado).toBe('AGOTADA');
    expect(await stockDe(como, 'CD-LP-01', 'ART-10063')).toMatchObject({ disponible: 110, cuarentena: 0, vidaRestanteDias: 25 });
  });

  it('8. envases: entrega, devolución y rechazo al devolver de más', async () => {
    const base = { cliente: 'Cliente 001', articulo: 'ART-10021', almacen: 'CD-LP-01' };
    expect((await como('ALM-LP').post('/envases/entrega', { ...base, cantidad: 30 })).body.pendiente).toBe(70); // 40 sembrados + 30
    const demas = await como('ALM-LP').post('/envases/devolucion', { ...base, cantidad: 71 });
    expect(demas.status).toBe(409);
    expect(demas.body).toMatchObject({ codigo: 'DEVOLUCION_EXCEDE', detalles: { pendiente: 70 } });
    expect((await como('ALM-LP').post('/envases/devolucion', { ...base, cantidad: 70 })).body.pendiente).toBe(0);
    expect((await como('ALM-LP').post('/envases/entrega', { ...base, articulo: 'ART-10022', cantidad: 1 })).body.codigo).toBe('ARTICULO_NO_RETORNABLE');

    const saldos = (await como('SUP-01').get('/envases/saldos?cliente=Cliente 003')).body;
    expect(saldos[0]).toMatchObject({ pendiente: 50, antiguedadDias: 76 });
    expect(await prisma.movimiento.count({ where: { tipo: { in: ['ENVASE_ENTREGA', 'ENVASE_DEVOLUCION'] }, motivo: { contains: 'Cliente 001' } } })).toBe(4);
  });
});
