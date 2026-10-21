import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { FiltroErrores } from './comun/errores.js';
import { errorDeValidacion } from './comun/validacion.js';
import { estadoDemo } from './demo/estado.js';

// Configuración común de la app (la usan main.ts y los tests de integración).
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  // Mientras se restablecen los datos de la demo, el resto de las peticiones recibe un 503 claro.
  app.use((req: { url: string }, res: { status: (n: number) => { json: (b: object) => void } }, next: () => void) =>
    estadoDemo.restableciendo && !req.url.includes('/simulacion/restablecer-datos')
      ? res.status(503).json({ codigo: 'DEMO_RESTABLECIENDO', mensaje: 'Se están restableciendo los datos de la demo; reintenta en unos segundos', detalles: null })
      : next(),
  );
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: errorDeValidacion }));
  app.useGlobalFilters(new FiltroErrores());
  return app;
}
