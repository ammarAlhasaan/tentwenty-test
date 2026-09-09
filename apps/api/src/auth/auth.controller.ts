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
  // Nest answers POST with 201 by default. Logging in creates no resource the
  // client can address, so the contract is 200.
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) body: LoginBody,
    @Req() request: Request,
  ): Promise<{ user: User }> {
    const user = await this.auth.verifyCredentials(body.email, body.password);

    // One message for both "no such account" and "wrong password", from one code
    // path, so the two responses cannot drift apart and start leaking which
    // accounts exist.
    if (!user) throw new UnauthorizedException('Invalid email or password');

    // Regenerate before attaching the user: a session identifier an attacker
    // fixed on the client beforehand is discarded here rather than becoming an
    // authenticated one. `regenerate` also replaces the object at
    // `request.session`, so `userId` is assigned after it resolves -- writing to
    // a reference captured earlier would leave the new session anonymous.
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
    const user = this.auth.findById(request.session.userId!);

    // The session named a user who no longer exists. Treated as unauthenticated
    // rather than as a 500, since from the caller's side it is the same thing.
    if (!user) throw new UnauthorizedException();

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    // Not behind SessionAuthGuard on purpose: logging out of an already-expired
    // session would then fail with 401, so a client could not safely call this
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
