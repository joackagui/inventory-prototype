import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { capasDe, type Como, esperarIntegridad, iniciar, stockDe } from './utilidades.js';

describe('Conteos, ajustes y mermas', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('6. conteo con diferencia → ajuste pendiente → aprobación por R07 con capas y movimientos correctos', async () => {
    const conteo = await como('ALM-LP').post('/conteos', { tipo: 'CICLICO', almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10021', cantidadContada: 1074 });
    expect(conteo.status).toBe(201);
    expect(conteo.body.conteo).toMatchObject({ cantidadSistema: 1080, diferencia: -6, porcentaje: 0.56, requiereRecuento: true });
    expect(conteo.body.ajuste).toMatchObject({ estado: 'PENDIENTE', cantidad: -6, motivo: 'DIFERENCIA_CONTEO' });
    const param = await prisma.parametroArticuloAlmacen.findFirstOrThrow({ where: { articulo: { codigo: 'ART-10021' }, almacen: { codigo: 'CD-LP-01' } } });
    expect(param.ultimoConteo?.toISOString().slice(0, 10)).toBe('2027-06-30');

    const id = conteo.body.ajuste.id;
    expect((await como('ALM-LP').post(`/ajustes/${id}/aprobar`)).status).toBe(403); // R06 no aprueba
    const ok = await como('LOG-01').post(`/ajustes/${id}/aprobar`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ estado: 'APROBADO', valor: -74.4 }); // 6 × 12.40 de la capa más antigua
    expect((await capasDe(prisma, 'ART-10021', 'CD-LP-01')).map((c) => c.cantidadRestante)).toEqual([354, 360, 360]);
    const mov = await prisma.movimiento.findFirstOrThrow({ where: { documentoTipo: 'AjusteInventario', documentoId: id } });
    expect(mov).toMatchObject({ tipo: 'AJUSTE', cantidad: -6 });
    // Un ajuste resuelto no se vuelve a modificar.
    expect((await como('LOG-01').post(`/ajustes/${id}/rechazar`, { comentario: 'No corresponde' })).body.codigo).toBe('AJUSTE_YA_RESUELTO');
  });

  it('conteo dentro de la tolerancia no pide recuento', async () => {
    const r = await como('ALM-LP').post('/conteos', { tipo: 'CICLICO', almacen: 'CD-LP-01', ubicacion: 'PICK-B', articulo: 'ART-30005', cantidadContada: 209 });
    expect(r.body.conteo).toMatchObject({ porcentaje: 0.48, requiereRecuento: false });
  });

  it('6. quien registra no aprueba; R06 no opera otro almacén', async () => {
    expect((await como('ALM-LP').post('/conteos', { tipo: 'CICLICO', almacen: 'CD-CB-01', ubicacion: 'PICK-A', articulo: 'ART-10021', cantidadContada: 1 })).body.codigo).toBe('ALMACEN_AJENO');
    expect((await como('ALM-LP').post('/ajustes', { almacen: 'CD-SC-01', articulo: 'ART-10021', cantidad: -1, motivo: 'ROTURA' })).body.codigo).toBe('ALMACEN_AJENO');
    const propio = await como('LOG-01').post('/ajustes', { almacen: 'CD-CB-01', articulo: 'ART-20011', cantidad: -2, motivo: 'ROTURA' });
    expect(propio.status).toBe(201);
    expect((await como('LOG-01').post(`/ajustes/${propio.body.id}/aprobar`)).body.codigo).toBe('AUTOAPROBACION');
    expect((await como('LOG-01').post(`/ajustes/${propio.body.id}/rechazar`, { comentario: 'No corresponde' })).body.codigo).toBe('AUTOAPROBACION');
  });

  it('merma por rotura (sembrada) se rechaza y un ajuste positivo crea capa al costo de la última', async () => {
    const pendientes = (await como('LOG-01').get('/ajustes?estado=PENDIENTE')).body;
    const rotura = pendientes.find((a: { motivo: string; almacen: { codigo: string } }) => a.motivo === 'ROTURA' && a.almacen.codigo === 'CD-LP-01');
    expect((await como('LOG-01').post(`/ajustes/${rotura.id}/rechazar`, { comentario: 'No corresponde' })).body.estado).toBe('RECHAZADO');

    const ultima = (await capasDe(prisma, 'ART-30005', 'CD-LP-01')).at(-1)!;
    const alta = await como('ALM-LP').post('/ajustes', { almacen: 'CD-LP-01', articulo: 'ART-30005', cantidad: 5, motivo: 'ERROR_REGISTRO' });
    await como('LOG-01').post(`/ajustes/${alta.body.id}/aprobar`);
    const nueva = (await capasDe(prisma, 'ART-30005', 'CD-LP-01')).at(-1)!;
    expect(nueva.id).not.toBe(ultima.id);
    expect([nueva.cantidadRestante, Number(nueva.costoUnitario)]).toEqual([5, Number(ultima.costoUnitario)]);
    expect((await stockDe(como, 'CD-LP-01', 'ART-30005')).disponible).toBe(215);
  });

  it('una baja que dejaría menos stock que lo reservado se rechaza al aprobar', async () => {
    // CB ART-10021: 760 físicos con 120 reservados; bajar 700 dejaría 60 < 120.
    const a = await como('ALM-CB').post('/ajustes', { almacen: 'CD-CB-01', articulo: 'ART-10021', cantidad: -700, motivo: 'PERDIDA_ROBO' });
    expect((await como('LOG-01').post(`/ajustes/${a.body.id}/aprobar`)).body.codigo).toBe('AJUSTE_AFECTA_RESERVAS');
    expect((await stockDe(como, 'CD-CB-01', 'ART-10021')).disponible).toBe(640);
  });
});
