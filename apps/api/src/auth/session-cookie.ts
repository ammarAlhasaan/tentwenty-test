import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'sid';

/**
 * The cookie attributes, in one place because `clearCookie` on logout must use
 * exactly the same `path`, `sameSite` and `secure` values the cookie was set
 * with -- a mismatch leaves the browser holding it.
 */
export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    // Lax, not None: localhost:3000 and localhost:4000 differ by port only, and
    // SameSite is scoped to the registrable domain, so the frontend's requests
    // still carry the cookie while a genuinely cross-site POST does not. None
    // would additionally require Secure, which rules out local plain HTTP.
    sameSite: 'lax',
    // Only in production: with Secure set, a browser on plain HTTP is never sent
    // the cookie at all, which would make local sign-in impossible.
    secure: isProduction,
    path: '/',
  };
}
