import type { INestApplication } from '@nestjs/common';
import { estadoDemo } from '../src/demo/estado.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, vigentes } from './utilidades.js';

describe('Análisis, fiestas, costos y herramientas de demo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('ABC con clase actual, nivel de servicio, Z y frecuencia de conteo', async () => {
    const abc = (await como('GER-01').get('/abc')).body;
    expect(abc.slice(0, 3).map((a: { codigo: string }) => a.codigo)).toEqual(['ART-10021', 'ART-10022', 'ART-10035']);
    expect(abc[2]).toMatchObject({ clase: 'A', claseActual: 'A', porcentajeAcumulado: 74.69, nivelServicio: 0.98, z: 2.05, frecuenciaConteoDias: 30 });
    expect(abc.at(-1)).toMatchObject({ codigo: 'ART-30005', clase: 'C', z: 1.28, frecuenciaConteoDias: 180 });
  });

  it('rotación anualizada, días de inventario y cobertura; conteos y exactitud', async () => {
    const r = (await como('GER-01').get('/analisis/rotacion?almacenId=CD-LP-01')).body;
    expect(r).toMatchObject({ almacen: 'CD-LP-01', desde: '2027-03-12', hasta: '2027-06-29', umbrales: { alta: 30, media: 15 } });
    const a = r.articulos.find((x: { codigo: string }) => x.codigo === 'ART-10021');
    expect(a.rotacionAnual).toBe(Math.round(((a.costoVendido90 * 252) / 90 / a.valorStockPromedio) * 100) / 100);
    expect(a.diasInventario).toBe(Math.round((a.valorStockPromedio / (a.costoVendido90 / 90)) * 10) / 10);
    expect(a).toMatchObject({ coberturaDias: 7.7, nivel: a.rotacionAnual >= 30 ? 'ALTA' : a.rotacionAnual >= 15 ? 'MEDIA' : 'BAJA' });
    expect((await como('PV-014').get('/analisis/rotacion')).status).toBe(403);

    const c = (await como('GER-01').get('/analisis/conteos')).body;
    expect(c).toMatchObject({ toleranciaPct: 0.5, exactitud: { porcentaje: 93.3, conteos: 15, sinDiferencia: 14 } });
    expect(c.conteos[0]).toMatchObject({ articulo: 'ART-20011', almacen: 'CD-CB-01', diferencia: -4, porcentaje: 0.67, superaTolerancia: true });
  });

  it('fiestas: cronograma con la fecha simulada, estado, ventana y promoción sugerida; cambia con otra fecha', async () => {
    const aniversario = async () => (await como('LOG-01').get('/fiestas/preparacion?almacenId=CD-LP-01')).body.fiestas.find((f: { nombre: string }) => f.nombre.startsWith('Aniversario de La Paz'));
    const a = await aniversario();
    expect(a).toMatchObject({ estado: 'CRITICO', ventanaDesde: '2027-06-18', promocionSugerida: { tipo: 'DESCUENTO_FESTIVO', desde: '2027-07-02', hasta: '2027-08-06' } });
    const estados = (f: { cronograma: { clave: string; estado: string }[] }) => Object.fromEntries(f.cronograma.map((h) => [h.clave, h.estado]));
    expect(estados(a)).toMatchObject({ '3-semanas': 'EN_CURSO', '2-semanas': 'PROXIMO' });
    expect(a.cronograma.find((h: { clave: string }) => h.clave === '3-semanas')).toMatchObject({ desde: '2027-06-25', responsables: ['R06', 'R07'], accion: expect.stringContaining('60 días') });
    expect(a.almacenes[0].articulos.find((x: { codigo: string }) => x.codigo === 'ART-10021')).toMatchObject({ factor: 1.3, leadTimeDias: 3, stockSeguridad: 60, ropFiesta: 546 });

    const e = await como('TI-01').post('/simulacion/escenario', { nombre: 'una-semana-antes-aniversario' });
    expect(e.body).toMatchObject({ escenario: 'una-semana-antes-aniversario', fechaSimulada: '2027-07-09' });
    expect(estados(await aniversario())).toMatchObject({ '2-semanas': 'PASADO', '1-semana': 'EN_CURSO' });
    await como('TI-01').post('/simulacion/restablecer');
  });

  it('escenario «vencimientos»: AL04 de la capa de 25 días pasa a rojo; solo R07/R09', async () => {
    expect((await como('ALM-LP').post('/simulacion/escenario', { nombre: 'vencimientos' })).status).toBe(403);
    expect((await como('LOG-01').post('/simulacion/escenario', { nombre: 'otro' })).status).toBe(400);
    const r = (await como('LOG-01').post('/simulacion/escenario', { nombre: 'vencimientos' })).body;
    expect(r.fechaSimulada).toBe('2027-07-10');
    expect(r.efectoAlertas.cambiadas).toContainEqual(expect.objectContaining({ codigo: 'AL04', articulo: 'ART-10063', colorAntes: 'AMARILLO', colorDespues: 'ROJO' }));
    expect((await como('GER-01').get('/simulacion/escenarios')).body.map((e: { nombre: string }) => e.nombre)).toEqual(['base', 'una-semana-antes-aniversario', 'vencimientos', 'navidad-8-semanas']);
    await como('LOG-01').post('/simulacion/escenario', { nombre: 'base' });
  });

  it('rechazar una promoción exige comentario y la deja RECHAZADA', async () => {
    const p = await como('SUP-01').post('/promociones', { nombre: 'Prueba', tipo: 'BONIFICACION', articulo: 'ART-20011', fechaInicio: '2027-07-01', fechaFin: '2027-07-31', topeCajas: 10 });
    expect((await como('LOG-01').post(`/promociones/${p.body.id}/rechazar`, {})).body.detalles).toContain('comentario no puede estar vacío');
    expect((await como('SUP-01').post(`/promociones/${p.body.id}/rechazar`, { comentario: 'x' })).status).toBe(403);
    const r = (await como('LOG-01').post(`/promociones/${p.body.id}/rechazar`, { comentario: 'Tope sin stock que lo respalde' })).body;
    expect(r).toMatchObject({ estado: 'RECHAZADA', comentarioResolucion: 'Tope sin stock que lo respalde', rechazadaPor: { codigo: 'LOG-01' } });
    expect((await como('LOG-01').post(`/promociones/${p.body.id}/rechazar`, { comentario: 'otra vez' })).body.codigo).toBe('PROMOCION_NO_PROPUESTA');
  });

  it('integridad con el detalle de cada comprobación', async () => {
    const r = (await como('TI-01').get('/integridad')).body;
    expect(r.comprobaciones.map((c: { nombre: string; ok: boolean }) => [c.nombre, c.ok])).toEqual([
      ['Σ capas = Σ movimientos por artículo y almacén', true],
      ['Ninguna capa con saldo negativo o inconsistente', true],
      ['Vencimiento posterior a la elaboración', true],
      ['Un lote, un solo costo y vencimiento', true],
      ['Movimientos inmutables (trigger activo)', true],
      ['Reservado = Σ reservas vigentes', true],
    ]);
    expect(r.comprobaciones.find((c: { nombre: string }) => c.nombre.startsWith('Movimientos')).revisados).toBe(await prisma.movimiento.count());
    expect(r.comprobaciones.every((c: { ms: number; revisados: number }) => c.ms >= 0 && c.revisados > 0)).toBe(true);
  });

  it('usuarios con resumen de permisos; costos con vista previa de tasas', async () => {
    const u = (await como('TI-01').get('/usuarios/permisos')).body;
    expect(u).toHaveLength(9);
    expect(u.find((x: { codigo: string }) => x.codigo === 'ALM-LP')).toMatchObject({ rol: 'R06', almacen: 'CD-LP-01', permisos: expect.arrayContaining(['No aprueba ajustes']) });
    expect((await como('ALM-LP').get('/usuarios/permisos')).status).toBe(403);

    const base = (await como('LOG-01').get('/costos?almacenId=CD-LP-01&mes=2027-06')).body;
    const previa = (await como('LOG-01').get('/costos?almacenId=CD-LP-01&mes=2027-06&tasaConservacionAnual=0.3&costoPorTraslado=200')).body;
    const a = (r: { articulos: { codigo: string; conservacion: number }[] }) => r.articulos.find((x) => x.codigo === 'ART-10021')!;
    expect(previa.tasas).toMatchObject({ tasaConservacionAnual: 0.3, costoPorTraslado: 200 });
    expect(a(previa).conservacion).toBeCloseTo(a(base).conservacion * 2, 1);
    expect((await como('LOG-01').get('/costos?mes=2027-06')).body.tasas.tasaConservacionAnual).toBe(0.15); // la vista previa no guardó nada
  });

  it('restablecer datos: exige RESTABLECER y DEMO_MODE; deja el estado base; 503 mientras corre', async () => {
    await como('LOG-01').post('/simulacion/escenario', { nombre: 'vencimientos' });
    await como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10048', cantidad: 50, costoUnitario: 12.2, lote: 'X', fechaElaboracion: '2027-07-09' });
    expect((await como('LOG-01').post('/simulacion/restablecer-datos', { confirmacion: 'si' })).body.detalles).toEqual(['confirmacion debe ser exactamente RESTABLECER']);
    expect((await como('ALM-LP').post('/simulacion/restablecer-datos', { confirmacion: 'RESTABLECER' })).status).toBe(403);
    process.env.DEMO_MODE = 'false';
    expect((await como('TI-01').post('/simulacion/restablecer-datos', { confirmacion: 'RESTABLECER' })).body.codigo).toBe('DEMO_DESACTIVADA');
    process.env.DEMO_MODE = 'true';

    estadoDemo.restableciendo = true;
    const ocupado = await como('LOG-01').get('/stock?almacenId=CD-LP-01');
    estadoDemo.restableciendo = false;
    expect(ocupado.status).toBe(503);
    expect(ocupado.body.codigo).toBe('DEMO_RESTABLECIENDO');

    const r = (await como('TI-01').post('/simulacion/restablecer-datos', { confirmacion: 'RESTABLECER' })).body;
    expect(r).toMatchObject({ fechaSimulada: '2027-06-30', alertasVigentes: 19, integridad: { ok: true } });
    expect((await como().get('/salud')).body.fechaSimulada).toBe('2027-06-30');
    expect(await vigentes(como)).toHaveLength(19);
    expect((await como('TI-01').get('/bitacora')).body[0]).toMatchObject({ entidad: 'Demo', campo: 'restablecimiento', usuario: { codigo: 'TI-01' } });
  });
});
