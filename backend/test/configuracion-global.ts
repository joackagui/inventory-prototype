import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { urlPruebas } from './url-pruebas.js';

export default async function () {
  const destino = urlPruebas();
  const nombre = new URL(destino).pathname.slice(1);
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const existe = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${nombre}`;
  if (!existe.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${nombre}"`);
  await admin.$disconnect();
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: destino }, stdio: 'ignore' });
}
