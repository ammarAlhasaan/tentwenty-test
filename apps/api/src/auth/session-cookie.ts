import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'sid';

/**
 * Kept in one place because `clearCookie` on logout must pass the same `path`,
 * `sameSite` and `secure` values the cookie was set with, or the browser keeps it.
 */
export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    // Lax rather than None: SameSite is scoped to the registrable domain and
    // ignores port, so the frontend on localhost:3000 still sends the cookie to
    // localhost:4000. None would additionally require Secure, ruling out local HTTP.
    sameSite: 'lax',
    // With Secure set, a browser on plain HTTP is never sent the cookie, which
    // would make local sign-in impossible.
    secure: isProduction,
    path: '/',
  };
}
