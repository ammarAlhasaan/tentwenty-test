import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

/**
 * Marks an endpoint as requiring a signed-in session. Apply with
 * `@UseGuards(SessionAuthGuard)` on a controller or a single handler.
 *
 * Not registered globally, because `GET /health` must stay public.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.session?.userId;

    if (!userId) throw new UnauthorizedException();

    // A session can outlive the account it names. Resolving the user here rather
    // than in each handler means every protected endpoint rejects that case
    // identically, instead of it depending on whether the handler happened to
    // look the user up.
    const user = await this.auth.findById(userId);
    if (!user) throw new UnauthorizedException();

    request.authUser = user;
    return true;
  }
}
