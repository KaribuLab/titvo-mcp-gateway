import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap function - Inicializa y arranca la aplicación NestJS
 *
 * Proceso:
 * 1. Crea la instancia de la aplicación NestJS
 * 2. Inicia el servidor HTTP en el puerto configurado
 *
 * Variables de entorno:
 * - PORT: Puerto del servidor (default: 3000)
 */
async function bootstrap() {
  process.env.NO_COLOR = 'true';
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
