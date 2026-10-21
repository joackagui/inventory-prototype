// Comprueba la integridad del inventario en la base. Uso: npm run db:verificar (sale con código 1 si algo no cuadra).
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { verificarIntegridad } from '../src/inventario/integridad.js';

config({ path: '../.env', quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const config = await prisma.configuracionSistema.findUnique({ where: { clave: 'fechaSimulada' } });
  const r = await verificarIntegridad(prisma, new Date(`${(config?.valor as string) ?? '2027-06-30'}T00:00:00Z`));
  if (r.ok) console.log(`✅ Integridad OK: ${r.capas} capas, ${r.combinaciones} combinaciones artículo/almacén.`);
  else {
    console.error(`❌ ${r.errores.length} problemas de integridad:\n- ${r.errores.join('\n- ')}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
