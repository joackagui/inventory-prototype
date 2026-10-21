// Ejecutor de `npm run db:seed`. La lógica está en src/demo/sembrar.ts (la reutilizan los tests y el restablecimiento de la demo).
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { sembrar } from '../src/demo/sembrar.js';

export { sembrar };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  config({ path: '../.env', quiet: true });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  sembrar(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
