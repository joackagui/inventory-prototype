import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { sembrar } from '../prisma/seed.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// App real sobre la base de pruebas recién sembrada con el escenario del 30/06/2027.
export async function iniciar() {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = configurarApp(modulo.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);
  await sembrar(prisma, { silencioso: true });
  return { app, prisma, como: cliente(app) };
}

// como('ALM-LP').post('/pedidos', {...}) → petición con el encabezado X-Usuario.
export function cliente(app: INestApplication) {
  return (usuario?: string) => {
    const r = request(app.getHttpServer());
    const con = (t: request.Test) => (usuario ? t.set('X-Usuario', usuario) : t);
    return {
      get: (url: string) => con(r.get(`/api${url}`)),
      post: (url: string, cuerpo: object = {}) => con(r.post(`/api${url}`)).send(cuerpo),
      put: (url: string, cuerpo: object = {}) => con(r.put(`/api${url}`)).send(cuerpo),
    };
  };
}

export type Como = ReturnType<typeof cliente>;

// Regla 11: después de cada test la integridad debe estar OK.
export async function esperarIntegridad(como: Como) {
  const r = await como('TI-01').get('/integridad');
  expect(r.status).toBe(200);
  expect(r.body.errores).toEqual([]);
  expect(r.body.ok).toBe(true);
}

export async function capasDe(prisma: PrismaService, articulo: string, almacen: string) {
  return prisma.capaFifo.findMany({
    where: { articulo: { codigo: articulo }, almacen: { codigo: almacen }, cantidadRestante: { gt: 0 } },
    orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }],
  });
}

export async function stockDe(como: Como, almacen: string, articulo: string) {
  const r = await como('LOG-01').get(`/stock?almacenId=${almacen}`);
  return r.body.articulos.find((a: { codigo: string }) => a.codigo === articulo);
}

export interface AlertaApi {
  id: number;
  codigo: string;
  color: string;
  estado: string;
  situacion: string;
  mensaje: string;
  referenciaTipo: string;
  referenciaId: number | null;
  nivelEscalamiento: number;
  resultado: string | null;
  almacen: { codigo: string } | null;
  articulo: { codigo: string } | null;
}

// Alertas vigentes (ABIERTA o ATENDIDA), opcionalmente filtradas por código, almacén y artículo.
export async function vigentes(como: Como, codigo?: string, almacen?: string, articulo?: string): Promise<AlertaApi[]> {
  const r = await como('LOG-01').get('/alertas?tamano=500');
  return (r.body.datos as AlertaApi[]).filter(
    (a) => a.estado !== 'RESUELTA' && (!codigo || a.codigo === codigo) && (!almacen || a.almacen?.codigo === almacen) && (!articulo || a.articulo?.codigo === articulo),
  );
}

export const tupla = (a: AlertaApi) => [a.almacen?.codigo ?? 'SISTEMA', a.codigo, a.color, a.articulo?.codigo ?? '-'];
