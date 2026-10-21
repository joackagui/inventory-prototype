import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

config({ path: '../.env', quiet: true });

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  const documento = new DocumentBuilder()
    .setTitle('Inventario CBN')
    .setDescription('API del prototipo de inventario. Identifícate con el encabezado X-Usuario (por ejemplo ALM-LP, LOG-01, PV-014).')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Usuario', in: 'header' }, 'X-Usuario')
    .addSecurityRequirements('X-Usuario')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, documento));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
