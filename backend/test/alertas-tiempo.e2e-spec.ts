import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, vigentes } from './utilidades.js';

describe('Alertas en el tiempo: vencimientos, escalamiento y alertas de documentos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  const avanzar = (dias: number) => como('TI-01').post('/simulacion/avanzar', { dias });
  const restablecer = () => como('TI-01').post('/simulacion/restablecer');
  const una = async (codigo: string, almacen?: string, articulo?: string) => {
    const lista = await vigentes(como, codigo, almacen, articulo);
    expect(lista).toHaveLength(1);
    return lista[0];
  };

  it('d. una roja sin atender escala al avanzar 2 días; una atendida no escala', async () => {
    const al02 = await una('AL02', 'CD-LP-01', 'ART-10048');
    await como('LOG-01').post(`/alertas/${al02.id}/atender`, { resultado: 'Traslado urgente pedido a SC' });
    await avanzar(2);
    const al01 = await una('AL01', 'CD-LP-01', 'ART-10035');
    expect(al01).toMatchObject({ color: 'ROJO', nivelEscalamiento: 1 });
    expect((await una('AL02', 'CD-LP-01', 'ART-10048')).nivelEscalamiento).toBe(0);
    const historial = (await como('LOG-01').get(`/alertas/${al01.id}`)).body.historial;
    expect(historial.at(-1)).toMatchObject({ tipo: 'ESCALADA', nivel: 1, detalle: 'Escalada a R07 Coordinador de logística', fechaOperacion: '2027-07-02T00:00:00.000Z' });
    expect((await como('GER-01').get('/alertas/resumen')).body.escaladas).toBeGreaterThan(0);
  });

  it('b. avanzar 5 días: AL05 pasa a rojo, el AL04 de cada capa se recalcula y las reservas envejecen', async () => {
    await avanzar(3); // 30/06 + 5 = 05/07
    const al05 = await una('AL05', 'CD-LP-01', 'ART-30005');
    expect(al05).toMatchObject({ color: 'ROJO', mensaje: 'Último conteo hace 190 días > 187 (clase C: cada 180 + 7).' });
    const historial = (await como('LOG-01').get(`/alertas/${al05.id}`)).body.historial;
    expect(historial.find((h: { tipo: string }) => h.tipo === 'CAMBIO_COLOR')).toMatchObject({ colorAnterior: 'AMARILLO', colorNuevo: 'ROJO' });
    const al04 = (await vigentes(como, 'AL04', 'CD-LP-01', 'ART-10063')).map((a) => [a.color, a.mensaje]).sort();
    expect(al04).toEqual([
      ['AMARILLO', 'Lote LP-10063-270126 (110 u.) con 20 días de vida ≤ 30.'],
      ['ROJO', 'Lote LP-10063-270113 (40 u.) con 7 días de vida ≤ 15: ya no se despacha.'],
    ]);
    expect((await vigentes(como, 'AL12')).map((a) => a.color)).toEqual(['ROJO', 'ROJO', 'ROJO', 'ROJO', 'ROJO']); // 5 reservas sembradas, 120 h
    expect((await una('AL01', 'CD-LP-01', 'ART-10035')).nivelEscalamiento).toBe(2);

    await restablecer();
    expect((await una('AL05', 'CD-LP-01', 'ART-30005')).color).toBe('AMARILLO');
    expect(await vigentes(como, 'AL12')).toHaveLength(0);
  });

  it('e. AL11 por un pedido sin stock y AL12 por una reserva sin despacho', async () => {
    const r = await como('PV-014').post('/pedidos', { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10048', cantidad: 30 }] });
    expect(r.status).toBe(409);
    expect(await vigentes(como, 'AL11')).toHaveLength(0); // 0 h: aún no supera 2 h
    await avanzar(1);
    expect((await una('AL11', 'CD-LP-01')).color).toBe('AMARILLO');
    expect(await vigentes(como, 'AL12')).toHaveLength(0); // 24 h no supera 24 h
    await avanzar(1);
    expect((await una('AL11', 'CD-LP-01')).color).toBe('ROJO');
    expect((await vigentes(como, 'AL12')).map((a) => a.color)).toEqual(['AMARILLO', 'AMARILLO', 'AMARILLO', 'AMARILLO', 'AMARILLO']);
    await como('PV-014').post(`/pedidos/${r.body.detalles.pedidoId}/cancelar`);
    expect(await vigentes(como, 'AL11')).toHaveLength(0);
    await restablecer();
  });

  it('e. AL13 por recepciones con costo +12% y +18% frente a la capa anterior', async () => {
    const ultima = await prisma.capaFifo.findFirstOrThrow({ where: { articulo: { codigo: 'ART-10048' }, almacen: { codigo: 'CD-LP-01' } }, orderBy: [{ fechaEntrada: 'desc' }, { id: 'desc' }] });
    const c1 = Math.round(Number(ultima.costoUnitario) * 1.12 * 100) / 100;
    const c2 = Math.round(c1 * 1.18 * 100) / 100;
    const recibir = (costoUnitario: number, lote: string) =>
      como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10048', cantidad: 100, costoUnitario, lote, fechaElaboracion: '2027-06-29' });
    await recibir(c1, 'LP-10048-A');
    expect((await una('AL13', 'CD-LP-01', 'ART-10048')).color).toBe('AMARILLO');
    await recibir(c2, 'LP-10048-B');
    expect((await vigentes(como, 'AL13', 'CD-LP-01', 'ART-10048')).map((a) => a.color).sort()).toEqual(['AMARILLO', 'ROJO']);
  });

  it('e. AL14 al acercarse una fiesta sin stock suficiente; se resuelve al reponer', async () => {
    await como('LOG-01').put('/simulacion/fecha', { fecha: '2027-07-10' }); // 6 días para el 16/07
    const al14 = await una('AL14', 'CD-LP-01', 'ART-10035');
    expect(al14).toMatchObject({ color: 'ROJO', mensaje: 'Aniversario de La Paz y Día de la Patria en 6 días: posición 20 < pronóstico 117 (faltan ≤ 7 días).' });
    await como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10035', cantidad: 200, costoUnitario: 14.2, lote: 'LP-10035-270709', fechaElaboracion: '2027-07-09' });
    expect(await vigentes(como, 'AL14', 'CD-LP-01', 'ART-10035')).toHaveLength(0);
    expect(await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10035')).toHaveLength(0);
    await restablecer();
  });

  it('e. AL09 por recepción con diferencia y por producto dañado', async () => {
    const trasladar = async (articulo: string, cantidad: number, recibida: object) => {
      const o = await como('LOG-01').post('/traslados', { origen: 'CD-SC-01', destino: 'CD-LP-01', lineas: [{ articulo, cantidad }] });
      await como('ALM-SC').post(`/traslados/${o.body.id}/despachar`);
      await como('ALM-LP').post(`/traslados/${o.body.id}/recibir`, { lineas: [{ articulo, ...recibida }] });
      return o.body;
    };
    const o1 = await trasladar('ART-10022', 200, { cantidadRecibida: 199 });
    expect(await una('AL09', 'CD-LP-01', 'ART-10022')).toMatchObject({ color: 'AMARILLO', mensaje: `Traslado ${o1.numero}: diferencia 1 de 200 (0.5%) ≤ 1%.` });
    const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { ordenTrasladoId: o1.id } });
    await como('LOG-01').post(`/ajustes/${ajuste.id}/aprobar`);
    expect(await vigentes(como, 'AL09', 'CD-LP-01', 'ART-10022')).toHaveLength(0);

    const o2 = await trasladar('ART-10021', 20, { cantidadRecibida: 20, estado: 'DANADO' });
    expect((await una('AL09', 'CD-LP-01', 'ART-10021')).color).toBe('ROJO');
    const danada = await prisma.capaFifo.findFirstOrThrow({ where: { ordenTrasladoId: o2.id, almacen: { codigo: 'CD-LP-01' } } });
    await como('LOG-01').post(`/cuarentena/${danada.id}/liberar`);
    expect(await vigentes(como, 'AL09', 'CD-LP-01', 'ART-10021')).toHaveLength(0);
  });

  it('e. AL16 con el simulador de falla y su reproceso', async () => {
    const e1 = await como('LOG-01').post('/simulacion/falla-integracion', { estado: 'COLA_ERRORES' });
    const e2 = await como('TI-01').post('/simulacion/falla-integracion', { estado: 'REINTENTO', tipo: 'FACTURACION', referencia: 'F-2027-0815' });
    expect((await vigentes(como, 'AL16')).map((a) => [a.almacen, a.color, a.referenciaId])).toEqual([
      [null, 'ROJO', e1.body.id],
      [null, 'AMARILLO', e2.body.id],
    ]);
    expect((await como('ALM-LP').post('/simulacion/falla-integracion', { estado: 'REINTENTO' })).status).toBe(403);
    expect((await como('LOG-01').post(`/integracion/eventos/${e1.body.id}/reprocesar`)).status).toBe(403);
    for (const e of [e1, e2]) expect((await como('TI-01').post(`/integracion/eventos/${e.body.id}/reprocesar`)).body.estado).toBe('PROCESADO');
    expect(await vigentes(como, 'AL16')).toHaveLength(0);
    expect((await como('TI-01').post(`/integracion/eventos/${e1.body.id}/reprocesar`)).body.codigo).toBe('EVENTO_YA_PROCESADO');
    expect((await como('LOG-01').get('/integracion/eventos')).body).toHaveLength(2);
  });
});
