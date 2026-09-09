import { Store, type SessionData } from 'express-session';
import type { DatabaseService } from '../database/database.service.js';

type SessionRow = { data: string; expires_at: number };

export class SqliteSessionStore extends Store {
  constructor(
    private readonly database: DatabaseService,
    private readonly ttlMs: number,
  ) {
    super();
  }

  get(sid: string, callback: (err?: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.database.db
        .prepare('SELECT data, expires_at FROM sessions WHERE sid = ?')
        .get(sid) as SessionRow | undefined;

      if (!row) return callback(null, null);

      // An expired row is reported as absent, not as an error: express-session
      // treats a missing session as "not signed in", which is exactly right here.
      if (row.expires_at <= Date.now()) {
        this.database.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return callback(null, null);
      }

      callback(null, JSON.parse(row.data) as SessionData);
    } catch (error) {
      // better-sqlite3 is synchronous and throws. An escaping throw would bypass
      // the request's error path entirely, so it is handed to the callback
      // instead. A row whose JSON no longer parses is treated as absent rather
      // than locking the client out of ever logging in again.
      if (error instanceof SyntaxError) return callback(null, null);
      callback(error);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      this.database.db
        .prepare(
          `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
        )
        .run(sid, JSON.stringify(session), this.expiresAt(session));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.database.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      this.database.db
        .prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?')
        .run(this.expiresAt(session), sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  private expiresAt(session: SessionData): number {
    const expires = session.cookie?.expires;
    if (expires) return new Date(expires).getTime();
    return Date.now() + (session.cookie?.maxAge ?? this.ttlMs);
  }
}
