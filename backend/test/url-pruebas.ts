import { config } from 'dotenv';

// Base de pruebas en el mismo contenedor: DATABASE_URL_TEST o la de .env con la base inventario_test.
export function urlPruebas() {
  config({ path: '../.env', quiet: true });
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/inventario_test';
  return url.toString();
}
