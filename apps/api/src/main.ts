import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // The origin is an array, not a bare string: `cors` echoes a string origin
  // unconditionally, whereas the array form omits the header entirely for an
  // origin that does not match. `credentials` is enabled now because it is
  // incompatible with a wildcard origin, so BE-02's session cookie needs no
  // change here.
  app.enableCors({
    origin: [config.getOrThrow<string>('FRONTEND_ORIGIN')],
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(config.getOrThrow<number>('PORT'));
}
await bootstrap();
