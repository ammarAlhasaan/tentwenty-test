import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection: a state-changing request declaring an origin other than the
 * configured frontend origin is refused before it reaches a handler. `Origin` is
 * a forbidden header name, so page script cannot forge it.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.get('origin');

    // A missing `Origin` is allowed: browsers always send it cross-origin, so its
    // absence means a non-browser client, which CSRF does not describe.
    if (!origin) return true;

    if (origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
