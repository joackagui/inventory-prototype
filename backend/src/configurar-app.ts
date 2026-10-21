import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { FiltroErrores } from './comun/errores.js';

// Configuración común de la app (la usan main.ts y los tests de integración).
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroErrores());
  return app;
}
