import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, tupla, vigentes } from './utilidades.js';

describe('Efecto en alertas, capas consumidas y endpoints de detalle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('el nuevo historial deja el estado base intacto: 19 alertas y historia sana', async () => {
    expect((await vigentes(como)).map(tupla).length).toBe(19);
    // Regla de reposición: el ART-10021 de La Paz casi nunca cierra el día bajo el ROP (antes pasaba una vez por ciclo).
    const serie = (await como('LOG-01').get('/articulos/ART-10021/serie?almacenId=CD-LP-01&dias=120')).body.puntos;
    expect(serie.filter((p: { bajoRop: boolean }) => p.bajoRop).length).toBeLessThanOrEqual(12);
    // Excepción puntual: el ART-10035 de La Paz tuvo una reposición demorada (quiebre en el historial).
    const huari = (await como('LOG-01').get('/articulos/ART-10035/serie?almacenId=CD-LP-01&dias=120')).body.puntos;
    expect(huari.some((p: { saldo: number; fecha: string }) => p.saldo === 0 && p.fecha < '2027-06-01')).toBe(true);
  });

  it('despacho: capas consumidas con su costo y efecto en alertas; recepción que lo resuelve', async () => {
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 600 }] });
    // La reserva ya baja el disponible (920 − 600 = 320 ≤ ROP 420): AL01 nace al reservar, no al despachar.
    expect(p.body.efectoAlertas.creadas).toEqual([
      expect.objectContaining({ codigo: 'AL01', almacen: 'CD-LP-01', articulo: 'ART-10021', colorAntes: null, colorDespues: 'AMARILLO', mensaje: 'Posición 320 ≤ ROP 420. Traslado propuesto: 940.' }),
    ]);
    const d = await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    expect(d.body.capasConsumidas).toEqual([
      { capaId: expect.any(Number), lote: 'LP-10021-270518', cantidad: 360, costoUnitario: 12.4, valor: 4464, vencimiento: '2027-11-14', articulo: 'ART-10021', bonificacion: false },
      { capaId: expect.any(Number), lote: 'LP-10021-270528', cantidad: 240, costoUnitario: 12.52, valor: 3004.8, vencimiento: '2027-11-24', articulo: 'ART-10021', bonificacion: false },
    ]);
    expect(d.body.costoTotal).toBe(7468.8);
    expect(d.body.efectoAlertas).toEqual({ creadas: [], resueltas: [], cambiadas: [] });
    const r = await como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10021', cantidad: 700, costoUnitario: 12.7, lote: 'LP-10021-270629', fechaElaboracion: '2027-06-29' });
    expect(r.body.efectoAlertas.resueltas).toEqual([expect.objectContaining({ codigo: 'AL01', articulo: 'ART-10021', colorAntes: 'AMARILLO', colorDespues: null })]);
  });

  it('fecha simulada y parámetros también devuelven su efecto', async () => {
    const f = (await como('TI-01').post('/simulacion/avanzar', { dias: 5 })).body.efectoAlertas;
    expect(f.cambiadas).toContainEqual(expect.objectContaining({ codigo: 'AL05', articulo: 'ART-30005', colorAntes: 'AMARILLO', colorDespues: 'ROJO' }));
    expect(f.creadas.filter((a: { codigo: string }) => a.codigo === 'AL12')).toHaveLength(5);
    const v = (await como('TI-01').post('/simulacion/restablecer')).body.efectoAlertas;
    expect(v.resueltas.filter((a: { codigo: string }) => a.codigo === 'AL12')).toHaveLength(5);
    const prm = (await como('LOG-01').put('/parametros/ART-20011/CD-LP-01', { demandaDiaria: 100 })).body.efectoAlertas; // Máx 1,040 > 700
    expect(prm.resueltas).toContainEqual(expect.objectContaining({ codigo: 'AL03', articulo: 'ART-20011' }));
    await como('LOG-01').put('/parametros/ART-20011/CD-LP-01', { demandaDiaria: 60 });
  });

  it('traslado: capas consumidas al despachar y recibir; detalle con tránsito, diferencia y movimientos', async () => {
    const o = await como('LOG-01').post('/traslados', { origen: 'CD-SC-01', destino: 'CD-LP-01', lineas: [{ articulo: 'ART-10035', cantidad: 120 }] });
    const d = (await como('ALM-SC').post(`/traslados/${o.body.id}/despachar`)).body;
    expect(d.capasConsumidas.reduce((s: number, c: { cantidad: number }) => s + c.cantidad, 0)).toBe(120);
    expect(d.costoTotal).toBe(Math.round(d.capasConsumidas.reduce((s: number, c: { valor: number }) => s + c.valor, 0) * 100) / 100);
    expect(d.efectoAlertas.cambiadas).toContainEqual(expect.objectContaining({ codigo: 'AL01', articulo: 'ART-10035', colorAntes: 'ROJO', colorDespues: 'AMARILLO' }));
    const r = (await como('ALM-LP').post(`/traslados/${o.body.id}/recibir`, { lineas: [{ articulo: 'ART-10035', cantidadRecibida: 115 }] })).body;
    expect(r.capasConsumidas.reduce((s: number, c: { cantidad: number }) => s + c.cantidad, 0)).toBe(115);
    // AL09 sí; AL07 todavía no (el ajuste tiene 0 h).
    expect(r.efectoAlertas.creadas.map((a: { codigo: string }) => a.codigo)).toEqual(['AL09']);

    const det = (await como('GER-01').get(`/traslados/${o.body.id}`)).body;
    expect(det).toMatchObject({ estado: 'CON_DIFERENCIA', usuario: { codigo: 'LOG-01' }, enTransito: [expect.objectContaining({ cantidadRestante: 5 })] });
    expect(det.ajustes).toEqual([expect.objectContaining({ estado: 'PENDIENTE', cantidad: -5 })]);
    expect(det.movimientos.map((m: { tipo: string }) => m.tipo)).toEqual(expect.arrayContaining(['TRASLADO_SALIDA', 'TRASLADO_ENTRADA']));

    const aj = (await como('GER-01').get(`/ajustes/${det.ajustes[0].id}`)).body;
    expect(aj).toMatchObject({ motivo: 'DIFERENCIA_RECEPCION', ordenTraslado: { numero: o.body.numero }, impacto: { valor: expect.any(Number) } });
    expect(aj.impacto.valor).toBeLessThan(0);
    expect(aj.alertas.map((a: { codigo: string }) => a.codigo)).toContain('AL09');
    const ok = (await como('LOG-01').post(`/ajustes/${aj.id}/aprobar`, { comentario: 'Faltante confirmado con el transportista' })).body;
    expect(ok).toMatchObject({ estado: 'APROBADO', comentarioResolucion: 'Faltante confirmado con el transportista', costoTotal: -aj.impacto.valor });
    expect(ok.capasConsumidas.reduce((s: number, c: { cantidad: number }) => s + c.cantidad, 0)).toBe(5);
  });

  it('rechazar exige comentario; detalle de pedido y de saldo de envases; impacto previo y vista previa de recepción', async () => {
    const rotura = await prisma.ajusteInventario.findFirstOrThrow({ where: { motivo: 'ROTURA' } });
    expect((await como('LOG-01').post(`/ajustes/${rotura.id}/rechazar`, {})).body.detalles).toContain('comentario no puede estar vacío');
    expect((await como('LOG-01').post(`/ajustes/${rotura.id}/rechazar`, { comentario: 'Cajas recuperadas' })).body).toMatchObject({ estado: 'RECHAZADO', comentarioResolucion: 'Cajas recuperadas' });

    const ped = (await como('PV-014').get('/pedidos/1')).body;
    expect(ped).toMatchObject({ numero: 'PS-0001', estado: 'CONFIRMADO', cliente: { codigo: 'Cliente 001' }, usuario: { codigo: 'PV-014' }, antiguedadDias: 0 });
    expect(ped.movimientos.map((m: { tipo: string }) => m.tipo)).toEqual(['RESERVA']);

    const saldos = (await como('SUP-01').get('/envases/saldos?cliente=Cliente 003')).body;
    const env = (await como('SUP-01').get(`/envases/saldos/${saldos[0].id}`)).body;
    expect(env).toMatchObject({ pendiente: 50, antiguedadDias: 76, cliente: { codigo: 'Cliente 003' } });
    expect(env.movimientos.map((m: { tipo: string }) => m.tipo)).toEqual(['ENVASE_ENTREGA', 'ENVASE_DEVOLUCION']);

    // Cochabamba no se toca en los tests anteriores: capas 254 × 12.40, 253 × 12.52, 253 × 12.65.
    const imp = (await como('ALM-CB').get('/ajustes/impacto?almacen=CD-CB-01&articulo=ART-10021&cantidad=-400')).body;
    expect(imp).toEqual({ valor: -4977.52, capas: [{ lote: 'CB-10021-270419', cantidad: 254, costoUnitario: 12.4 }, { lote: 'CB-10021-270429', cantidad: 146, costoUnitario: 12.52 }], faltante: 0 });
    expect((await como('ALM-CB').get('/ajustes/impacto?almacen=CD-CB-01&articulo=ART-10021&cantidad=5')).body).toMatchObject({ valor: 63.25 }); // alta al costo de la última capa

    const pv = (await como('ALM-CB').get('/operaciones/recepcion/previa?almacen=CD-CB-01&articulo=ART-10021&costoUnitario=14.93&fechaElaboracion=2027-06-29')).body;
    expect(pv).toMatchObject({ ubicacionSugerida: 'PICK-A', vencimiento: '2027-12-26', capaAnterior: { costoUnitario: 12.65 }, variacionPct: 18.02, alertaCosto: { codigo: 'AL13', color: 'ROJO' } });
    expect((await como('PV-014').get('/operaciones/recepcion/previa?almacen=CD-LP-01&articulo=ART-10021')).status).toBe(403);
  });

  it('capas en cuarentena por almacén, clientes y promociones con tope y cobertura', async () => {
    const [vieja] = (await como('LOG-01').get('/capas?almacen=CD-LP-01&articulo=ART-10063')).body;
    await como('ALM-LP').post('/cuarentena', { capaId: vieja.id, cantidad: 10, motivo: 'Vence pronto' });
    const cuar = (await como('LOG-01').get('/capas?estado=CUARENTENA')).body;
    expect(cuar).toEqual([expect.objectContaining({ lote: vieja.lote, cantidadRestante: 10, articulo: { codigo: 'ART-10063', descripcion: expect.any(String) }, motivoNoDespachable: 'En cuarentena' })]);
    expect((await como('PV-014').get('/clientes')).body).toHaveLength(4);
    const [liq] = (await como('PV-014').get('/promociones?estado=ACTIVA')).body;
    expect(liq).toMatchObject({ topeRestante: 110, vendible: 110, coberturaDias: 5.5, diasRestantes: 12 });
  });
});
