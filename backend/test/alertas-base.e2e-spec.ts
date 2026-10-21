import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar, tupla, vigentes } from './utilidades.js';

describe('Alertas: estado base, operaciones, atención y permisos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('a. estado base del 30/06/2027: lista exacta de alertas abiertas', async () => {
    const lista = (await vigentes(como)).map(tupla).sort();
    expect(lista).toEqual(
      [
        // Esperadas
        ['CD-LP-01', 'AL01', 'AMARILLO', 'ART-10022'],
        ['CD-LP-01', 'AL01', 'ROJO', 'ART-10035'],
        ['CD-LP-01', 'AL02', 'ROJO', 'ART-10048'],
        ['CD-LP-01', 'AL03', 'AZUL', 'ART-20011'],
        ['CD-LP-01', 'AL04', 'ROJO', 'ART-10063'], // capa de 12 días
        ['CD-LP-01', 'AL05', 'AMARILLO', 'ART-30005'],
        ['CD-LP-01', 'AL07', 'AMARILLO', 'ART-10063'], // rotura −6 registrada el 28/06 (48 h)
        ['CD-LP-01', 'AL10', 'ROJO', 'ART-10021'], // Cliente 003, 76 días
        ['CD-CB-01', 'AL01', 'AMARILLO', 'ART-10022'],
        ['CD-CB-01', 'AL03', 'AZUL', 'ART-20011'],
        ['CD-CB-01', 'AL06', 'AMARILLO', 'ART-20011'],
        ['CD-CB-01', 'AL08', 'ROJO', 'ART-10035'],
        ['CD-SC-01', 'AL01', 'AMARILLO', 'ART-10048'],
        ['CD-SC-01', 'AL03', 'AZUL', 'ART-30005'],
        // Adicionales que salen de los datos del escenario
        ['CD-LP-01', 'AL04', 'AMARILLO', 'ART-10063'], // capa de 25 días (≤ 30)
        ['CD-LP-01', 'AL10', 'AMARILLO', 'ART-10035'], // Cliente 002, 41 días
        ['CD-LP-01', 'AL14', 'AMARILLO', 'ART-10035'], // Aniversario de La Paz en 16 días, posición 20 < 117
        ['CD-LP-01', 'AL14', 'AMARILLO', 'ART-10048'], // posición 0 < 91
        ['CD-LP-01', 'AL15', 'AMARILLO', 'ART-10063'], // liquidación: cobertura 5.5 < 12 días
      ].sort(),
    );
    // Sin escalamientos ni atenciones al empezar.
    const r = (await como('GER-01').get('/alertas/resumen')).body;
    expect(r).toMatchObject({ total: 19, porColor: { ROJO: 5, AMARILLO: 11, AZUL: 3 }, sinAtender: 19, escaladas: 0, porAlmacen: { 'CD-LP-01': 13, 'CD-CB-01': 4, 'CD-SC-01': 2 } });
  });

  it('la evaluación es idempotente', async () => {
    const r1 = (await como('TI-01').post('/alertas/evaluar')).body;
    const r2 = (await como('LOG-01').post('/alertas/evaluar')).body;
    for (const r of [r1, r2]) expect(r).toMatchObject({ creadas: 0, cambiosColor: 0, resueltas: 0, escaladas: 0, abiertas: 19 });
  });

  it('c. un despacho que deja el artículo bajo el ROP genera AL01; una recepción que lo sube lo resuelve sola', async () => {
    expect(await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10021')).toHaveLength(0);
    const p = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', almacen: 'CD-LP-01', lineas: [{ articulo: 'ART-10021', cantidad: 600 }] });
    await como('ALM-LP').post(`/pedidos/${p.body.id}/despachar`);
    const [al01] = await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10021');
    expect(al01).toMatchObject({ color: 'AMARILLO', mensaje: 'Posición 320 ≤ ROP 420. Traslado propuesto: 940.' });
    await como('ALM-LP').post('/operaciones/recepcion', { almacen: 'CD-LP-01', ubicacion: 'PICK-A', articulo: 'ART-10021', cantidad: 700, costoUnitario: 12.7, lote: 'LP-10021-270629', fechaElaboracion: '2027-06-29' });
    expect(await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10021')).toHaveLength(0);
    const resuelta = (await como('LOG-01').get(`/alertas/${al01.id}`)).body;
    expect(resuelta).toMatchObject({ estado: 'RESUELTA', resultado: 'condición normalizada', situacion: 'resuelta' });
    expect(resuelta.historial.map((h: { tipo: string }) => h.tipo)).toEqual(['CREADA', 'RESUELTA']);
  });

  it('f. permisos: R06 solo atiende alertas de su almacén y de su responsabilidad; R01 no accede', async () => {
    const [al04] = (await vigentes(como, 'AL04', 'CD-LP-01', 'ART-10063')).filter((a) => a.color === 'ROJO');
    const [al01] = await vigentes(como, 'AL01', 'CD-LP-01', 'ART-10035');
    const atender = { resultado: 'Lote pasado a liquidación', comentario: 'Revisado en piso' };
    expect((await como('ALM-CB').post(`/alertas/${al04.id}/atender`, atender)).body.codigo).toBe('NO_RESPONSABLE');
    expect((await como('ALM-LP').post(`/alertas/${al01.id}/atender`, atender)).body.codigo).toBe('NO_RESPONSABLE'); // AL01 es de R07
    expect((await como('GER-01').post(`/alertas/${al04.id}/atender`, atender)).status).toBe(403);
    const ok = await como('ALM-LP').post(`/alertas/${al04.id}/atender`, atender);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ estado: 'ATENDIDA', resultado: atender.resultado, comentario: atender.comentario, atendidaPor: { codigo: 'ALM-LP' } });
    expect(ok.body.fechaAtencion.slice(0, 10)).toBe('2027-06-30');
    expect((await como('ALM-LP').post(`/alertas/${al04.id}/atender`, atender)).body.codigo).toBe('ALERTA_NO_ABIERTA');

    // Atender no cierra la condición.
    await como('LOG-01').post('/alertas/evaluar');
    expect((await como('LOG-01').get(`/alertas/${al04.id}`)).body).toMatchObject({ estado: 'ATENDIDA', situacion: 'atendida, condición vigente' });

    const [al10] = (await vigentes(como, 'AL10', 'CD-LP-01')).filter((a) => a.color === 'ROJO');
    expect((await como('SUP-01').post(`/alertas/${al10.id}/atender`, { resultado: 'Llamado al cliente' })).status).toBe(200); // R02 es corresponsable
    expect((await como('PV-014').get('/alertas')).status).toBe(403);
    expect((await como('PV-014').get('/semaforo?almacenId=CD-LP-01')).status).toBe(403);
    expect((await como('GER-01').get('/alertas?color=ROJO&almacen=CD-CB-01')).body.datos.map((a: { codigo: string }) => a.codigo)).toEqual(['AL08']);
    expect((await como('SUP-01').get('/alertas?rol=R02')).body.datos.every((a: { codigo: string }) => ['AL02', 'AL10', 'AL15'].includes(a.codigo))).toBe(true);
  });

  it('semáforo: color global por artículo y códigos activos', async () => {
    const filas = (await como('GER-01').get('/semaforo?almacenId=CD-LP-01')).body.articulos;
    const fila = (c: string) => filas.find((f: { codigo: string }) => f.codigo === c);
    expect(fila('ART-10048')).toMatchObject({ color: 'ROJO', alertas: ['AL02', 'AL14'], vendible: 0 });
    expect(fila('ART-20011')).toMatchObject({ color: 'AZUL', alertas: ['AL03'] });
    expect(fila('ART-10022')).toMatchObject({ color: 'AMARILLO', alertas: ['AL01'], trasladoPropuesto: 496 });
    expect(fila('ART-10063')).toMatchObject({ color: 'ROJO', alertas: ['AL04', 'AL07', 'AL15'], vendible: 110, disponible: 150 });
    // AL10 (envases del Cliente 003) se asocia al artículo del envase: también pinta su fila.
    expect(fila('ART-10021')).toMatchObject({ color: 'ROJO', alertas: ['AL10'] });
    expect(fila('ART-30005')).toMatchObject({ color: 'AMARILLO', alertas: ['AL05'] });
  });

  it('umbrales editables: validan el orden, quedan en la bitácora y reevalúan', async () => {
    expect((await como('ALM-LP').put('/alertas/umbrales/AL04', { valor: { amarilloDias: 60 } })).status).toBe(403);
    const malo = await como('LOG-01').put('/alertas/umbrales/AL04', { valor: { amarilloDias: 10 } });
    expect(malo.body).toMatchObject({ codigo: 'UMBRAL_INVALIDO' });
    expect(malo.body.mensaje).toContain('antes que el rojo');
    expect((await como('LOG-01').put('/alertas/umbrales/AL04', { valor: { amarilloDias: 60 } })).body.AL04).toEqual({ amarilloDias: 60, rojoDias: 15 });
    // ART-20011 en La Paz tiene 58 días de vida: ahora entra en AL04.
    expect((await vigentes(como, 'AL04', 'CD-LP-01', 'ART-20011')).map((a) => a.color)).toEqual(['AMARILLO']);
    const bitacora = (await como('TI-01').get('/bitacora')).body.filter((b: { entidadId: string }) => b.entidadId === 'umbralesAlertas');
    expect(bitacora[0]).toMatchObject({ valorAnterior: { AL04: { amarilloDias: 30 } }, valorNuevo: { AL04: { amarilloDias: 60 } } });
    await como('LOG-01').put('/alertas/umbrales/AL04', { valor: { amarilloDias: 30 } });
    expect(await vigentes(como, 'AL04', 'CD-LP-01', 'ART-20011')).toHaveLength(0);
  });

  it('los errores de validación salen en español', async () => {
    const r = await como('PV-014').post('/pedidos', { cliente: 'Cliente 001', lineas: [{ articulo: 'ART-10021', cantidad: -2 }], extra: 1 });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ codigo: 'SOLICITUD_INVALIDA', mensaje: 'Los datos enviados no son válidos' });
    expect(r.body.detalles).toEqual(expect.arrayContaining(['extra no es un campo permitido', 'almacen no puede estar vacío', 'lineas.0.cantidad debe ser mayor que 0']));
    expect((await como('LOG-01').get('/alertas/abc')).body.detalles).toBe('El identificador debe ser un número entero');
  });

  it('promociones: R02 propone, R07 aprueba con referencia de correo, sin solaparse', async () => {
    const base = { nombre: 'Pack Pepsi de regalo', tipo: 'BONIFICACION', articulo: 'ART-20011', almacen: 'CD-LP-01', fechaInicio: '2027-07-01', fechaFin: '2027-07-31', topeCajas: 100 };
    expect((await como('ALM-LP').post('/promociones', base)).status).toBe(403);
    const p1 = await como('SUP-01').post('/promociones', base);
    expect(p1.body).toMatchObject({ estado: 'PROPUESTA', propuestaPor: { codigo: 'SUP-01' } });
    const sinCorreo = await como('LOG-01').post(`/promociones/${p1.body.id}/aprobar`, {});
    expect(sinCorreo.body.detalles).toContain('referenciaCorreo no puede estar vacío');
    const a1 = await como('LOG-01').post(`/promociones/${p1.body.id}/aprobar`, { referenciaCorreo: 'CORREO-GLV-2027-0412' });
    expect(a1.body).toMatchObject({ estado: 'ACTIVA', referenciaCorreo: 'CORREO-GLV-2027-0412', aprobadoPor: { codigo: 'LOG-01' } });

    const p2 = await como('SUP-01').post('/promociones', { ...base, nombre: 'Otra', fechaInicio: '2027-07-15', fechaFin: '2027-08-15' });
    expect((await como('LOG-01').post(`/promociones/${p2.body.id}/aprobar`, { referenciaCorreo: 'X' })).body.codigo).toBe('PROMOCION_SOLAPADA');
    expect((await como('LOG-01').post(`/promociones/${p1.body.id}/cerrar`)).body.estado).toBe('FINALIZADA');
    expect((await como('LOG-01').post(`/promociones/${p2.body.id}/aprobar`, { referenciaCorreo: 'X' })).body.estado).toBe('ACTIVA');
    expect((await como('SUP-01').post('/promociones', { ...base, fechaFin: '2027-06-01' })).body.codigo).toBe('VIGENCIA_INVALIDA');
    expect((await como('GER-01').get('/promociones?estado=ACTIVA')).body.map((p: { nombre: string }) => p.nombre).sort()).toEqual(['Liquidación Bock por vencimiento', 'Otra']);
    expect(await prisma.promocion.count({ where: { estado: 'FINALIZADA' } })).toBe(1);
  });
});
