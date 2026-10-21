import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Las credenciales viven en el .env de la raíz del proyecto (compartido con docker-compose).
config({ path: '../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
