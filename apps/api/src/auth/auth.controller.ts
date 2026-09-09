import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { type LoginBody, loginSchema } from './auth.schema.js';
import { AuthService, type User } from './auth.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) body: LoginBody,
    @Req() request: Request,
  ): Promise<{ user: User }> {
    const user = await this.auth.verifyCredentials(body.email, body.password);

    if (!user) throw new UnauthorizedException('Invalid email or password');

    // Regenerate before attaching the user, so a session id fixed on the client
    // beforehand cannot become an authenticated one. `regenerate` replaces the
    // object at `request.session`, so `userId` must be assigned after it
    // resolves -- writing to a reference captured earlier would leave the new
    // session anonymous.
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) => (error ? reject(error) : resolve())),
    );

    request.session.userId = user.id;

    await new Promise<void>((resolve, reject) =>
      request.session.save((error) => (error ? reject(error) : resolve())),
    );

    return { user };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: Request): { user: User } {
    return { user: request.authUser! };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // Deliberately not behind SessionAuthGuard: logging out of an expired
    // session would then fail with 401, so a client could not call it
    // unconditionally.
    if (request.session) {
      await new Promise<void>((resolve, reject) =>
        request.session.destroy((error) => (error ? reject(error) : resolve())),
      );
    }

    const isProduction = this.config.getOrThrow<string>('NODE_ENV') === 'production';
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(isProduction));
  }
}
