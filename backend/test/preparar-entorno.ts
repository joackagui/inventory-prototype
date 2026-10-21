import { urlPruebas } from './url-pruebas.js';

// Antes de importar la app: PrismaService lee DATABASE_URL al construirse.
process.env.DATABASE_URL = urlPruebas();
