import { Store, type SessionData } from 'express-session';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * express-session's Store contract is callback-based, so every method here
 * bridges a Prisma promise to a callback. `void promise.then(...)` is
 * deliberate: an unhandled rejection escaping into the event loop would crash
 * the process, whereas the error belongs on the callback where express-session
 * can turn it into a normal request failure.
 */
export class PrismaSessionStore extends Store {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ttlMs: number,
  ) {
    super();
  }

  get(sid: string, callback: (err?: unknown, session?: SessionData | null) => void): void {
    void this.read(sid).then(
      (session) => callback(null, session),
      (error: unknown) => callback(error),
    );
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    const data = JSON.stringify(session);
    const expiresAt = this.expiresAt(session);

    void this.prisma.session
      .upsert({
        where: { sid },
        create: { sid, data, expiresAt },
        update: { data, expiresAt },
      })
      .then(
        () => callback?.(),
        (error: unknown) => callback?.(error),
      );
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    // deleteMany, not delete: removing a session that is already gone is a
    // success, and `delete` would reject on a missing row.
    void this.prisma.session.deleteMany({ where: { sid } }).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    );
  }

  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    void this.prisma.session
      .updateMany({ where: { sid }, data: { expiresAt: this.expiresAt(session) } })
      .then(
        () => callback?.(),
        (error: unknown) => callback?.(error),
      );
  }

  private async read(sid: string): Promise<SessionData | null> {
    const row = await this.prisma.session.findUnique({ where: { sid } });
    if (!row) return null;

    // An expired row is reported as absent, not as an error: express-session
    // treats a missing session as "not signed in", which is exactly right here.
    if (row.expiresAt <= BigInt(Date.now())) {
      await this.prisma.session.deleteMany({ where: { sid } });
      return null;
    }

    try {
      return JSON.parse(row.data) as SessionData;
    } catch {
      // A row whose JSON no longer parses is treated as absent rather than
      // locking the client out of ever logging in again.
      return null;
    }
  }

  /** Milliseconds since the epoch, as BigInt: the value exceeds Prisma's 32-bit Int. */
  private expiresAt(session: SessionData): bigint {
    const expires = session.cookie?.expires;
    if (expires) return BigInt(new Date(expires).getTime());
    return BigInt(Date.now() + (session.cookie?.maxAge ?? this.ttlMs));
  }
}
