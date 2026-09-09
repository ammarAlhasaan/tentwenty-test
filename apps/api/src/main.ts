import { HttpException, HttpStatus, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { AppModule } from './app.module.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './auth/session-cookie.js';
import { SqliteSessionStore } from './auth/sqlite-session.store.js';
import { DatabaseService } from './database/database.service.js';

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

  const ttlMs = config.getOrThrow<number>('SESSION_TTL_HOURS') * 60 * 60 * 1000;
  const isProduction = config.getOrThrow<string>('NODE_ENV') === 'production';

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      store: new SqliteSessionStore(app.get(DatabaseService), ttlMs),
      resave: false,
      // Anonymous requests write no session row, so an unauthenticated caller
      // cannot fill the table by making requests.
      saveUninitialized: false,
      // Slides the expiry forward on each response, so an active user is not
      // signed out mid-session.
      rolling: true,
      cookie: { ...sessionCookieOptions(isProduction), maxAge: ttlMs },
    }),
  );

  // Login only. Failed attempts are what the limit is for -- a correct password
  // does not consume the allowance, so someone mistyping their own password a
  // few times is not locked out by finally getting it right.
  app.use(
    '/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      // Thrown rather than written directly, so the rejection goes through the
      // application's error filter and carries the same body shape as every
      // other error response.
      handler: () => {
        throw new HttpException(
          'Too many login attempts, please try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(config.getOrThrow<number>('PORT'));
}
await bootstrap();
