import type { INestApplication } from '@nestjs/common';
import { costoConservacion } from '../src/inventario/calculos/formulas.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, vigentes } from './utilidades.js';

describe('Endpoints de análisis: tablero, costos, fiestas y Pareto de ajustes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('permisos: R01 recibe 403 en los cuatro endpoints', async () => {
    for (const url of ['/tablero/resumen', '/costos', '/fiestas/preparacion', '/analisis/pareto-ajustes']) {
      expect((await como('PV-014').get(url)).status).toBe(403);
      expect((await como('GER-01').get(url)).status).toBe(200);
    }
  });

  it('tablero: valores del escenario base, global y de La Paz', async () => {
    const global = (await como('GER-01').get('/tablero/resumen')).body;
    expect(global).toMatchObject({
      almacen: null,
      fechaOperacion: '2027-06-30',
      valorCuarentena: 0,
      articulos: { total: 21, enQuiebre: 1, bajoRop: 4, normales: 13, enExceso: 3, venceEn30Dias: 1 },
      alertas: { total: 19, porColor: { ROJO: 5, AMARILLO: 11, AZUL: 3 }, sinAtender: 19, rojasSinAtender: 5, escaladas: 0 },
      trasladosEnTransito: { ordenes: 1, unidades: 210 },
      ajustesPendientes: 2,
      pedidosPendientesRevision: 0,
      exactitudInventario: { porcentaje: 93.3, conteos: 15, sinDiferencia: 14 },
    });
    expect(global.valorPorAlmacen.map((v: { almacen: string }) => v.almacen)).toEqual(['CD-LP-01', 'CD-CB-01', 'CD-SC-01']);

    const lp = (await como('LOG-01').get('/tablero/resumen?almacenId=CD-LP-01')).body;
    expect(lp).toMatchObject({ articulos: { total: 7, enQuiebre: 1, bajoRop: 2, normales: 3, enExceso: 1, venceEn30Dias: 1 }, exactitudInventario: { porcentaje: 100, conteos: 5 }, alertas: { total: 13 } });
    // Valor = Σ cantidad restante × costo de las capas DISPONIBLES.
    const capas = await prisma.capaFifo.findMany({ where: { almacen: { codigo: 'CD-LP-01' }, estado: 'DISPONIBLE' } });
    expect(lp.valorInventario).toBe(Math.round(capas.reduce((s, c) => s + c.cantidadRestante * Number(c.costoUnitario), 0) * 100) / 100);
    // Cobertura ponderada por demanda = Σ disponible ÷ Σ d (La Paz: 2,440 ÷ 375 ≈ 6.5).
    const params = await prisma.parametroArticuloAlmacen.findMany({ where: { almacen: { codigo: 'CD-LP-01' } } });
    expect(lp.coberturaMediaDias).toBe(Math.round(((920 + 240 + 20 + 0 + 150 + 700 + 210) / params.reduce((s, p) => s + p.demandaDiaria, 0)) * 10) / 10);
    // Ventas: 30 días hábiles cerrados (hasta el día anterior a la fecha simulada), desde los movimientos de SALIDA.
    expect(lp.ventasDiarias).toHaveLength(30);
    expect(lp.ventasDiarias[0].fecha).toBe('2027-05-24');
    const salidas = await prisma.movimiento.findMany({ where: { tipo: 'SALIDA', almacen: { codigo: 'CD-LP-01' }, fechaOperacion: new Date('2027-06-29') }, include: { articulo: true } });
    expect(lp.ventasDiarias.at(-1)).toEqual({ fecha: '2027-06-29', unidades: -salidas.reduce((s, m) => s + m.cantidad, 0), usd: Math.round(-salidas.reduce((s, m) => s + m.cantidad * Number(m.articulo.precio), 0) * 100) / 100 });
  });

  it('costos de junio: adquisición, conservación, pedido y agotamiento', async () => {
    const lp = (await como('LOG-01').get('/costos?almacenId=CD-LP-01&mes=2027-06')).body;
    expect(lp).toMatchObject({ mes: '2027-06', diasConsiderados: 30, tasas: { tasaConservacionAnual: 0.15, costoPorTraslado: 180, costoAgotamientoPorPedido: 12 } });
    const a = lp.articulos.find((x: { codigo: string }) => x.codigo === 'ART-10021');
    const salidas = await prisma.movimiento.findMany({ where: { tipo: 'SALIDA', articulo: { codigo: 'ART-10021' }, almacen: { codigo: 'CD-LP-01' }, fechaOperacion: { gte: new Date('2027-06-01'), lt: new Date('2027-07-01') } } });
    expect(a.unidadesVendidas).toBe(-salidas.reduce((s, m) => s + m.cantidad, 0));
    expect(a.adquisicion).toBe(Math.round(-salidas.reduce((s, m) => s + Number(m.valor), 0) * 100) / 100);
    expect(a.conservacion).toBe(costoConservacion(a.valorStockPromedio, 0.15));
    expect(a.total).toBe(Math.round((a.adquisicion + a.conservacion + a.pedido + a.agotamiento) * 100) / 100);

    // Pedido: OT-2027-0001 (SC → CB, despachado el 23/06) cuesta USD 180 al ART-10035 de Cochabamba.
    const cb = (await como('LOG-01').get('/costos?almacenId=CD-CB-01&mes=2027-06')).body;
    expect(cb.articulos.filter((x: { pedido: number }) => x.pedido).map((x: { codigo: string; pedido: number }) => [x.codigo, x.pedido])).toEqual([['ART-10035', 180]]);

    // Agotamiento: un pedido con faltante = USD 40 × 30% = USD 12, aunque después se cancele.
    const r = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10048', cantidad: 10 }] });
    await como('PV-014').post(`/pedidos/${r.body.detalles.pedidoId}/cancelar`);
    const lp2 = (await como('LOG-01').get('/costos?almacenId=CD-LP-01')).body;
    expect(lp2.articulos.find((x: { codigo: string }) => x.codigo === 'ART-10048')).toMatchObject({ pedidosConFaltante: 1, agotamiento: 12 });
    expect(lp2.total.agotamiento).toBe(12);
    expect((await como('LOG-01').get('/costos?mes=2027-13')).body.detalles).toEqual(['mes no tiene el formato esperado']);
  });

  it('preparación de fiestas: ROP, Q y Máx de Navidad y la brecha del aniversario de La Paz', async () => {
    const r = (await como('LOG-01').get('/fiestas/preparacion?almacenId=CD-LP-01')).body;
    expect(r.fiestas).toHaveLength(10);
    const navidad = r.fiestas.find((f: { nombre: string }) => f.nombre === 'Navidad');
    expect(navidad).toMatchObject({ diasFaltan: 177, semanasPreparacion: 8, enVentanaPreparacion: false, pasada: false });
    expect(navidad.almacenes[0].articulos.find((a: { codigo: string }) => a.codigo === 'ART-10021')).toMatchObject({ demandaBase: 120, ropFiesta: 714, qFiesta: 1428, maximoFiesta: 2142, pronostico: 408, posicion: 920, estado: 'OK' });
    const aniversario = r.fiestas.find((f: { nombre: string }) => f.nombre.startsWith('Aniversario de La Paz'));
    expect(aniversario).toMatchObject({ diasFaltan: 16, enVentanaPreparacion: true });
    expect(aniversario.almacenes[0].articulos.find((a: { codigo: string }) => a.codigo === 'ART-10035')).toMatchObject({ pronostico: 117, posicion: 20, brecha: 97, estado: 'CRITICO' });
    expect(r.fiestas.find((f: { nombre: string }) => f.nombre === 'Carnaval')).toMatchObject({ pasada: true });
    // Urkupiña es solo de Cochabamba: no aparece La Paz.
    expect(r.fiestas.find((f: { nombre: string }) => f.nombre === 'Urkupiña').almacenes).toEqual([]);
  });

  it('Pareto de ajustes aprobados por motivo, de mayor a menor valor', async () => {
    expect((await como('LOG-01').get('/analisis/pareto-ajustes')).body).toMatchObject({ total: 0, motivos: [] });
    const rotura = await prisma.ajusteInventario.findFirstOrThrow({ where: { motivo: 'ROTURA' } });
    await como('LOG-01').post(`/ajustes/${rotura.id}/aprobar`); // −6 × 12.80 = 76.80
    const alta = await como('ALM-LP').post('/ajustes', { almacen: 'CD-LP-01', articulo: 'ART-10021', cantidad: 2, motivo: 'ERROR_REGISTRO' });
    await como('LOG-01').post(`/ajustes/${alta.body.id}/aprobar`); // +2 × 12.65 = 25.30
    const r = (await como('GER-01').get('/analisis/pareto-ajustes?almacenId=CD-LP-01&desde=2027-06-01&hasta=2027-06-30')).body;
    expect(r.total).toBe(102.1);
    expect(r.motivos).toEqual([
      { motivo: 'ROTURA', ajustes: 1, unidades: 6, valor: 76.8, porcentaje: 75.22, porcentajeAcumulado: 75.22 },
      { motivo: 'ERROR_REGISTRO', ajustes: 1, unidades: 2, valor: 25.3, porcentaje: 24.78, porcentajeAcumulado: 100 },
    ]);
    expect((await como('GER-01').get('/analisis/pareto-ajustes?almacenId=CD-CB-01')).body.motivos).toEqual([]);
  });

  it('R03 (AST-01) consulta y solo atiende AL11; las alertas se ordenan por gravedad', async () => {
    expect((await como('AST-01').get('/yo')).body).toMatchObject({ rolCodigo: 'R03', almacenId: null });
    expect((await como('AST-01').get('/tablero/resumen')).status).toBe(200);
    expect((await como('AST-01').post('/pedidos', {})).status).toBe(403);
    await como('PV-014').post('/pedidos', { cliente: 'Cliente 002', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10048', cantidad: 5 }] });
    await como('TI-01').post('/simulacion/avanzar', { dias: 1 });
    const [al11] = await vigentes(como, 'AL11');
    const [al01] = await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10022');
    expect((await como('AST-01').post(`/alertas/${al01.id}/atender`, { resultado: 'x' })).body.codigo).toBe('NO_RESPONSABLE');
    expect((await como('AST-01').post(`/alertas/${al11.id}/atender`, { resultado: 'Pedido reprogramado' })).body.estado).toBe('ATENDIDA');

    const top = (await como('LOG-01').get('/alertas?orden=gravedad&tamano=6')).body.datos;
    expect(top).toHaveLength(6);
    expect(top.slice(0, 5).every((a: { color: string; estado: string }) => a.color === 'ROJO' && a.estado === 'ABIERTA')).toBe(true);
    expect(top[0].antiguedadDias).toBe(1);
    const fecha = (await como('TI-01').post('/simulacion/restablecer')).body;
    expect(fecha.alertas).toMatchObject({ abiertas: expect.any(Number), resueltas: expect.any(Number) });
  });
});
