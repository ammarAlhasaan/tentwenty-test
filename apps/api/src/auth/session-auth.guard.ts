import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Marks an endpoint as requiring a signed-in session. Apply with
 * `@UseGuards(SessionAuthGuard)` on a controller or a single handler.
 *
 * It is deliberately not registered globally: `GET /health` must stay public.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.session?.userId) throw new UnauthorizedException();

    return true;
  }
}
