import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { type Como, esperarIntegridad, iniciar } from './utilidades.js';

describe('Ficha del artículo, listado y Centro de alertas (backend)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let como: Como;

  beforeAll(async () => ({ app, prisma, como } = await iniciar()));
  afterAll(() => app.close());
  afterEach(() => esperarIntegridad(como));

  it('resumen del ART-10021 en La Paz: parámetros, estados, costos FIFO y stock por función', async () => {
    const r = (await como('LOG-01').get('/articulos/ART-10021/resumen?almacenId=CD-LP-01')).body;
    expect(r.articulo).toMatchObject({ codigo: 'ART-10021', precio: 18.7, vidaUtilDias: 180, esRetornable: true });
    expect(r.almacenes).toHaveLength(1);
    expect(r.almacenes[0]).toMatchObject({
      almacen: 'CD-LP-01',
      disponible: 920,
      vendible: 920,
      reservado: 160,
      enTransito: 0,
      posicion: 920,
      trasladoPropuesto: 0,
      parametros: { demandaDiaria: 120, desviacionDemanda: 17, leadTimeDias: 3, z: 2.05, nivelServicio: 0.98, stockSeguridad: 60, rop: 420, loteTraslado: 840, stockMaximo: 1260 },
      costoFifoMasAntigua: 12.4,
      costoUltimaCapa: 12.65,
      // Aniversario de La Paz (f 1.3): ROP de fiesta = 120 × 1.3 × 3 + 60 × 1.3 = 546 → estacional 546 − 420 = 126.
      funcion: { seguridad: 60, ciclo: 860, transito: 0, estacional: 126, fiesta: { nombre: 'Aniversario de La Paz y Día de la Patria', fechaInicio: '2027-07-16', ropFiesta: 546 } },
      color: 'ROJO', // AL10: envases del Cliente 003
    });
    const todos = (await como('GER-01').get('/articulos/ART-10021/resumen')).body.almacenes.map((a: { almacen: string; parametros: { rop: number } }) => [a.almacen, a.parametros.rop]);
    expect(todos).toEqual([['CD-LP-01', 420], ['CD-CB-01', 380], ['CD-SC-01', 450]]);
  });

  it('R01 recibe solo disponible/vendible; R01 no ve capas, kardex ni serie', async () => {
    const r = (await como('PV-014').get('/articulos/ART-10063/resumen')).body;
    expect(Object.keys(r.articulo).sort()).toEqual(['codigo', 'descripcion', 'esRetornable', 'familia', 'unidad']);
    expect(r.almacenes[0]).toEqual({ almacen: 'CD-LP-01', nombre: 'Planta y CD La Paz', disponible: 110, vendible: 110, estado: 'DISPONIBLE' });
    for (const url of ['/articulos/ART-10021/capas', '/articulos/ART-10021/kardex?almacenId=CD-LP-01', '/articulos/ART-10021/serie?almacenId=CD-LP-01']) {
      expect((await como('PV-014').get(url)).status).toBe(403);
    }
  });

  it('capas FIFO: costos 12.40 / 12.52 / 12.65, próxima en salir y capa no despachable', async () => {
    const lp = (await como('LOG-01').get('/articulos/ART-10021/capas')).body.filter((c: { almacen: { codigo: string } }) => c.almacen.codigo === 'CD-LP-01');
    expect(lp.map((c: { costoUnitario: number }) => c.costoUnitario)).toEqual([12.4, 12.52, 12.65]);
    expect(lp.map((c: { proximaEnSalir: boolean }) => c.proximaEnSalir)).toEqual([true, false, false]);
    expect(lp[0]).toMatchObject({ cantidadRestante: 360, valor: 4464, despachable: true, vidaRestanteDias: 137 });

    const bock = (await como('LOG-01').get('/articulos/ART-10063/capas')).body.filter((c: { almacen: { codigo: string } }) => c.almacen.codigo === 'CD-LP-01');
    expect(bock.map((c: { vidaRestanteDias: number; despachable: boolean; proximaEnSalir: boolean; motivoNoDespachable: string | null }) => [c.vidaRestanteDias, c.despachable, c.proximaEnSalir, c.motivoNoDespachable])).toEqual([
      [12, false, false, 'Menos de 15 días de vida'],
      [25, true, true, null],
    ]);
  });

  it('simular parámetros no guarda nada; solo R07', async () => {
    const antes = await prisma.registroCambio.count();
    const r = await como('LOG-01').post('/parametros/ART-10021/CD-LP-01/simular', { demandaDiaria: 150 });
    expect(r.status).toBe(200);
    expect(r.body.actual).toMatchObject({ demandaDiaria: 120, rop: 420, stockMaximo: 1260 });
    expect(r.body.simulado).toMatchObject({ demandaDiaria: 150, stockSeguridad: 60, rop: 510, loteTraslado: 1050, stockMaximo: 1560, z: 2.05 });
    const nivel = (await como('LOG-01').post('/parametros/ART-10021/CD-LP-01/simular', { nivelServicio: 0.99, leadTimeDias: 4 })).body.simulado;
    expect(nivel).toMatchObject({ z: 2.33, stockSeguridad: 79, rop: 559 }); // 2.33 × 17 × √4 = 79.2 → 79; 120 × 4 + 79
    expect(await prisma.registroCambio.count()).toBe(antes);
    expect((await prisma.parametroArticuloAlmacen.findFirstOrThrow({ where: { articulo: { codigo: 'ART-10021' }, almacen: { codigo: 'CD-LP-01' } } })).rop).toBe(420);
    expect((await como('ALM-LP').post('/parametros/ART-10021/CD-LP-01/simular', { demandaDiaria: 150 })).status).toBe(403);
    expect((await como('LOG-01').post('/parametros/ART-10021/CD-LP-01/simular', { demandaDiaria: -1 })).body.detalles).toEqual(['demandaDiaria no puede ser menor que 0']);
  });

  it('serie del stock y kardex con saldo acumulado, filtros y paginación', async () => {
    const serie = (await como('GER-01').get('/articulos/ART-10021/serie?almacenId=CD-LP-01&dias=30')).body;
    expect(serie).toMatchObject({ almacen: 'CD-LP-01', stockSeguridad: 60, rop: 420, stockMaximo: 1260 });
    expect(serie.puntos).toHaveLength(30);
    expect(serie.puntos.at(-1)).toEqual({ fecha: '2027-06-30', saldo: 1080, bajoRop: false });

    const k = (await como('GER-01').get('/articulos/ART-10021/kardex?almacenId=CD-LP-01&tamano=5')).body;
    expect(k.datos).toHaveLength(5);
    expect(k.datos[0]).toMatchObject({ saldo: 1080, saldoValor: 13525.2 }); // el más reciente primero
    const entradas = (await como('GER-01').get('/articulos/ART-10021/kardex?almacenId=CD-LP-01&tipo=ENTRADA&tamano=500')).body;
    expect(entradas.datos.every((m: { tipo: string }) => m.tipo === 'ENTRADA')).toBe(true);
    const junio = (await como('GER-01').get('/articulos/ART-10021/kardex?almacenId=CD-LP-01&desde=2027-06-01&hasta=2027-06-30&tamano=500')).body;
    expect(junio.datos.every((m: { fechaOperacion: string }) => m.fechaOperacion >= '2027-06-01')).toBe(true);
    expect(junio.total).toBeLessThan(k.total);
  });

  it('listado de artículos: estado por almacén, cobertura mínima y alertas; R01 reducido', async () => {
    const filas = (await como('GER-01').get('/articulos/estado')).body;
    expect(filas).toHaveLength(7);
    const taquina = filas.find((f: { codigo: string }) => f.codigo === 'ART-10048');
    expect(taquina).toMatchObject({ claseAbc: 'B', precio: 18.2, vendibleTotal: 300, coberturaMinimaDias: 0, alertasVigentes: 3 });
    expect(taquina.almacenes.map((a: { almacen: string; color: string }) => [a.almacen, a.color])).toEqual([['CD-LP-01', 'ROJO'], ['CD-CB-01', 'VERDE'], ['CD-SC-01', 'AMARILLO']]);
    const r01 = (await como('PV-014').get('/articulos/estado')).body.find((f: { codigo: string }) => f.codigo === 'ART-10048');
    expect(r01).toEqual({ codigo: 'ART-10048', descripcion: 'Taquiña 620 ml retornable · caja x12', familia: 'CERVEZA', almacenes: [{ almacen: 'CD-LP-01', estado: 'AGOTADO' }, { almacen: 'CD-CB-01', estado: 'DISPONIBLE' }, { almacen: 'CD-SC-01', estado: 'DISPONIBLE' }] });
  });

  it('alertas: filtros nuevos, nombre, medición y R06 limitado a su almacén', async () => {
    const familia = (await como('LOG-01').get('/alertas?estado=VIGENTE&codigos=AL01,AL02,AL03&tamano=500')).body;
    expect(familia.total).toBe(8); // AL01 × 4, AL02 × 1, AL03 × 3
    expect(familia.datos.every((a: { codigo: string; nombre: string }) => ['AL01', 'AL02', 'AL03'].includes(a.codigo) && a.nombre)).toBe(true);
    expect((await como('LOG-01').get('/alertas?sinAtender=true&color=ROJO')).body.total).toBe(5);
    const antiguas = (await como('LOG-01').get('/alertas?orden=antiguedad&tamano=500')).body.datos;
    expect(antiguas).toHaveLength(19);

    const lp = (await como('ALM-LP').get('/alertas?tamano=500')).body.datos;
    expect(lp.length).toBe(13);
    expect(lp.every((a: { almacen: { codigo: string } }) => a.almacen.codigo === 'CD-LP-01')).toBe(true);
    expect((await como('ALM-LP').get('/alertas?almacen=CD-CB-01')).body.total).toBe(13); // el filtro no saca a R06 de su almacén
    expect((await como('ALM-LP').get('/alertas/resumen')).body).toMatchObject({ almacen: 'CD-LP-01', total: 13 });
    const [al08] = (await como('LOG-01').get('/alertas?codigo=AL08')).body.datos;
    expect((await como('ALM-LP').get(`/alertas/${al08.id}`)).body.codigo).toBe('ALMACEN_AJENO');

    const [al01] = (await como('LOG-01').get('/alertas?codigo=AL01&almacen=CD-LP-01&articulo=ART-10022')).body.datos;
    const detalle = (await como('LOG-01').get(`/alertas/${al01.id}`)).body;
    expect(detalle).toMatchObject({ nombre: 'Reposición', medicion: { valor: 240, amarillo: 246, rojo: 36, menorEsPeor: true, unidad: 'u.' } });

    const umbrales = (await como('GER-01').get('/alertas/umbrales/detalle')).body;
    expect(umbrales).toHaveLength(12);
    expect(umbrales.find((x: { clave: string }) => x.clave === 'AL04')).toEqual({ clave: 'AL04', nombre: 'Vencimiento próximo', valor: { amarilloDias: 30, rojoDias: 15 }, porDefecto: { amarilloDias: 30, rojoDias: 15 } });
  });
});
