import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection. A state-changing request that declares an origin other than
 * the configured frontend origin is refused before it reaches a handler.
 *
 * This works because `Origin` is a forbidden header name: page JavaScript
 * cannot set it, so a cross-site page cannot pass this check. Together with the
 * `SameSite=Lax` session cookie, which is not sent on cross-site unsafe methods
 * at all, it is the defence OWASP endorses for a JSON API behind a strict CORS
 * allowlist -- no token endpoint, and no change required in the frontend.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.get('origin');

    // A request with no `Origin` at all is allowed through: browsers always send
    // it on cross-origin requests, so its absence means a non-browser client
    // such as curl, which is not the threat CSRF describes. Refusing here would
    // also make the documented manual verification impossible.
    if (!origin) return true;

    if (origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
