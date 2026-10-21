import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar } from './utilidades.js';

describe('Parámetros, fecha simulada y permisos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('9. cambiar parámetros recalcula SS, ROP, Q y Máx y deja registro de cambio', async () => {
    expect((await como('ALM-LP').put('/parametros/ART-10021/CD-LP-01', { demandaDiaria: 150 })).status).toBe(403);
    const r = await como('LOG-01').put('/parametros/ART-10021/CD-LP-01', { demandaDiaria: 150 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ demandaDiaria: 150, stockSeguridad: 60, rop: 510, loteTraslado: 1050, stockMaximo: 1560 });
    const n = await como('LOG-01').put('/parametros/ART-10021/CD-LP-01', { nivelServicio: 0.99 });
    expect(n.body).toMatchObject({ z: 2.33, stockSeguridad: 69, rop: 519 });

    const bitacora = (await como('TI-01').get('/bitacora')).body.filter((b: { entidad: string }) => b.entidad === 'ParametroArticuloAlmacen');
    expect(bitacora).toHaveLength(2);
    expect(bitacora[1]).toMatchObject({ valorAnterior: { rop: 420, demandaDiaria: 120 }, valorNuevo: { rop: 510, demandaDiaria: 150 }, usuario: { codigo: 'LOG-01' } });
  });

  it('9. recalcular ABC reclasifica cuando cambia la demanda', async () => {
    const sinCambios = await como('LOG-01').post('/abc/recalcular');
    expect(sinCambios.body.cambios).toEqual([]);
    // 4.60 × 700 = 3,220 USD/día: supera al ART-10021 (18.70 × 150 = 2,805 tras el test anterior).
    await como('LOG-01').put('/parametros/ART-30005/CD-LP-01', { demandaDiaria: 700 });
    const r = await como('LOG-01').post('/abc/recalcular');
    expect(r.body.clasificacion[0]).toMatchObject({ codigo: 'ART-30005', clase: 'A' });
    expect(r.body.cambios).toContainEqual({ articulo: 'ART-30005', almacen: 'CD-LP-01', de: 'C', a: 'A' });
    const p = await prisma.parametroArticuloAlmacen.findFirstOrThrow({ where: { articulo: { codigo: 'ART-30005' }, almacen: { codigo: 'CD-SC-01' } } });
    expect(p).toMatchObject({ claseAbc: 'A', z: 2.05, diasRevision: 7 });
  });

  it('fecha simulada: solo R07/R09, queda en la bitácora y la usan los movimientos nuevos', async () => {
    expect((await como('ALM-LP').put('/simulacion/fecha', { fecha: '2027-07-10' })).status).toBe(403);
    expect((await como('TI-01').post('/simulacion/avanzar', { dias: 5 })).body).toEqual({ fechaSimulada: '2027-07-05', fechaAnterior: '2027-06-30' });
    expect((await como().get('/salud')).body.fechaSimulada).toBe('2027-07-05');
    const r = await como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-B', articulo: 'ART-20011', cantidad: 10, costoUnitario: 5.3, lote: 'X1', fechaElaboracion: '2027-07-04' });
    expect(r.body.fechaEntrada.slice(0, 10)).toBe('2027-07-05');
    expect((await prisma.movimiento.findFirstOrThrow({ where: { capaId: r.body.id } })).fechaOperacion.toISOString().slice(0, 10)).toBe('2027-07-05');
    expect((await como('LOG-01').put('/simulacion/fecha', { fecha: '2027-13-40' })).status).toBe(400);
    expect((await como('LOG-01').post('/simulacion/restablecer')).body.fechaSimulada).toBe('2027-06-30');
    const cambios = (await como('TI-01').get('/bitacora')).body.filter((b: { entidadId: string }) => b.entidadId === 'fechaSimulada');
    expect(cambios).toHaveLength(2);
  });

  it('10. permisos: R01 sin costos ni recepciones, R08 solo lee, sin usuario 401', async () => {
    const r01 = await como('PV-014').get('/stock?almacenId=CD-LP-01');
    expect(r01.status).toBe(200);
    expect(Object.keys(r01.body.articulos[0]).sort()).toEqual(['codigo', 'descripcion', 'disponible', 'estado']);
    expect(r01.body.articulos.find((a: { codigo: string }) => a.codigo === 'ART-10048').estado).toBe('AGOTADO');
    for (const url of ['/articulos', '/articulos/ART-10021/kardex?almacenId=CD-LP-01', '/movimientos', '/abc']) {
      expect((await como('PV-014').get(url)).status).toBe(403);
    }
    expect((await como('PV-014').post('/operaciones/recepcion', {})).status).toBe(403);

    const r08 = await como('GER-01').get('/stock?almacenId=CD-LP-01');
    expect(r08.body.articulos[0].costoFifo).toBe(12.4);
    expect((await como('GER-01').get('/movimientos?almacen=CD-LP-01&tamano=5')).body).toMatchObject({ pagina: 1, tamano: 5 });
    expect((await como('GER-01').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 1 }] })).status).toBe(403);
    expect((await como('GER-01').post('/ajustes', { almacen: 'CD-LP-01', articulo: 'ART-10021', cantidad: -1, motivo: 'ROTURA' })).status).toBe(403);
    expect((await como('SUP-01').put('/simulacion/fecha', { fecha: '2027-07-01' })).status).toBe(403);

    const sin = await como().get('/stock?almacenId=CD-LP-01');
    expect(sin.status).toBe(401);
    expect(sin.body.codigo).toBe('NO_AUTENTICADO');
    expect((await como('X-999').get('/yo')).status).toBe(401);
    expect((await como().get('/usuarios')).body).toHaveLength(8);
    expect((await como('ALM-CB').get('/yo')).body).toMatchObject({ rolCodigo: 'R06', almacen: { codigo: 'CD-CB-01' } });
    expect((await como('PV-014').get('/integridad')).status).toBe(403);
  });
});
