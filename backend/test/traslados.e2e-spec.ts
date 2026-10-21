import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, stockDe } from './utilidades.js';

describe('Traslados entre plantas', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  const totalSistema = async (articulo: string) =>
    (await prisma.capaFifo.aggregate({ where: { articulo: { codigo: articulo } }, _sum: { cantidadRestante: true } }))._sum.cantidadRestante;

  it('5. propuesta → emitir → despachar → recibir con diferencia, conservando lote y costo', async () => {
    // Propuesta para La Paz: ART-10022 con 496 y origen sugerido Santa Cruz (más cobertura sobre su ROP).
    const prop = await como('LOG-01').get('/traslados/propuesta?almacenId=CD-LP-01');
    const p10022 = prop.body.find((p: { articulo: string }) => p.articulo === 'ART-10022');
    expect(p10022).toMatchObject({ trasladoPropuesto: 496, origenSugerido: 'CD-SC-01', cantidadSugerida: 236 });

    expect((await como('ALM-LP').post('/traslados', { origen: 'CD-SC-01', destino: 'CD-LP-01', lineas: [{ articulo: 'ART-10022', cantidad: 236 }] })).status).toBe(403);
    const orden = await como('LOG-01').post('/traslados', { origen: 'CD-SC-01', destino: 'CD-LP-01', lineas: [{ articulo: 'ART-10022', cantidad: 236 }] });
    expect(orden.status).toBe(201);
    expect(orden.body).toMatchObject({ estado: 'EMITIDA', numero: 'OT-2027-0002' });
    const id = orden.body.id;

    const total = await totalSistema('ART-10022');
    expect((await como('ALM-LP').post(`/traslados/${id}/despachar`)).body.codigo).toBe('ALMACEN_AJENO');
    const desp = await como('ALM-SC').post(`/traslados/${id}/despachar`);
    expect(desp.status).toBe(200);
    expect(desp.body.estado).toBe('EN_TRANSITO');
    expect(await totalSistema('ART-10022')).toBe(total);
    expect(await stockDe(como, 'CD-LP-01', 'ART-10022')).toMatchObject({ disponible: 240, enTransito: 236, posicion: 476 });
    expect(await stockDe(como, 'CD-SC-01', 'ART-10022')).toMatchObject({ disponible: 264 });

    // Las capas en tránsito conservan lote, costo y vencimiento de las del origen.
    const enRuta = await prisma.capaFifo.findMany({ where: { ordenTrasladoId: id }, orderBy: { id: 'asc' } });
    const origenes = await prisma.capaFifo.findMany({ where: { almacen: { codigo: 'CD-SC-01' }, articulo: { codigo: 'ART-10022' }, lote: { in: enRuta.map((c) => c.lote) } } });
    expect(enRuta.reduce((s, c) => s + c.cantidadRestante, 0)).toBe(236);
    for (const c of enRuta) {
      const o = origenes.find((x) => x.lote === c.lote)!;
      expect([Number(c.costoUnitario), c.fechaVencimiento]).toEqual([Number(o.costoUnitario), o.fechaVencimiento]);
    }

    expect((await como('ALM-LP').post(`/traslados/${id}/recibir`, { lineas: [{ articulo: 'ART-10022', cantidadRecibida: 300 }] })).body.codigo).toBe('CANTIDAD_RECIBIDA_MAYOR');
    expect((await como('ALM-SC').post(`/traslados/${id}/recibir`, { lineas: [{ articulo: 'ART-10022', cantidadRecibida: 230 }] })).body.codigo).toBe('ALMACEN_AJENO');
    const rec = await como('ALM-LP').post(`/traslados/${id}/recibir`, { lineas: [{ articulo: 'ART-10022', cantidadRecibida: 230, observacion: 'Faltan 6 cajas' }] });
    expect(rec.status).toBe(200);
    expect(rec.body.estado).toBe('CON_DIFERENCIA');
    expect(rec.body.lineas[0]).toMatchObject({ cantidadDespachada: 236, cantidadRecibida: 230, estadoRecepcion: 'CONFORME' });

    // El total del sistema solo baja por la diferencia (6, registrada como merma en el tránsito).
    expect(await totalSistema('ART-10022')).toBe(total! - 6);
    expect(await stockDe(como, 'CD-LP-01', 'ART-10022')).toMatchObject({ disponible: 470, enTransito: 0 });
    const merma = await prisma.movimiento.findMany({ where: { documentoTipo: 'OrdenTraslado', documentoId: id, tipo: 'MERMA' } });
    expect(merma.reduce((s, m) => s + m.cantidad, 0)).toBe(-6);
    const recibidas = await prisma.capaFifo.findMany({ where: { almacen: { codigo: 'CD-LP-01' }, articulo: { codigo: 'ART-10022' }, fechaEntrada: new Date('2027-06-30') } });
    expect(recibidas.reduce((s, c) => s + c.cantidadRestante, 0)).toBe(230);
    for (const c of recibidas) expect(Number(c.costoUnitario)).toBe(Number(origenes.find((o) => o.lote === c.lote)!.costoUnitario));

    // No se recibe dos veces.
    expect((await como('ALM-LP').post(`/traslados/${id}/recibir`, { lineas: [{ articulo: 'ART-10022', cantidadRecibida: 230 }] })).body.codigo).toBe('TRASLADO_YA_RECIBIDO');
  });

  it('recibe el traslado sembrado SC→CB y lo dañado va a cuarentena', async () => {
    const orden = (await como('LOG-01').get('/traslados?estado=EN_TRANSITO')).body.find((o: { numero: string }) => o.numero === 'OT-2027-0001');
    expect(orden).toBeDefined();
    const r = await como('ALM-CB').post(`/traslados/${orden.id}/recibir`, { lineas: [{ articulo: 'ART-10035', cantidadRecibida: 210, estado: 'DANADO' }] });
    expect(r.body.estado).toBe('CON_DIFERENCIA');
    expect(await stockDe(como, 'CD-CB-01', 'ART-10035')).toMatchObject({ disponible: 90, cuarentena: 210, enTransito: 0 });
  });
});
