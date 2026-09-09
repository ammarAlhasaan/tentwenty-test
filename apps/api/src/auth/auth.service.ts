import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { DatabaseService } from '../database/database.service.js';

export type User = { id: number; email: string };
type UserRow = { id: number; email: string; password_hash: string };

@Injectable()
export class AuthService {
  // Verified against when no account matches, so a wrong password and an unknown
  // email take comparable time. Without it the unknown-email path would skip
  // Argon2id entirely and return in a fraction of the time, which is enough to
  // enumerate accounts with a stopwatch. Built once, from a random password
  // nobody holds, rather than being a hard-coded string.
  private dummyHash?: Promise<string>;

  constructor(private readonly database: DatabaseService) {}

  findById(id: number): User | null {
    const row = this.database.db
      .prepare('SELECT id, email FROM users WHERE id = ?')
      .get(id) as User | undefined;
    return row ?? null;
  }

  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const row = this.database.db
      .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;

    const matches = await this.safeVerify(row?.password_hash ?? (await this.getDummyHash()), password);

    if (!row || !matches) return null;
    return { id: row.id, email: row.email };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }

  async createUser(email: string, password: string): Promise<void> {
    const passwordHash = await hash(password);
    this.database.db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(email, passwordHash);
  }

  countUsers(): number {
    const row = this.database.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }

  private async safeVerify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // A malformed stored hash must read as "wrong password", not as a 500 that
      // tells the caller this particular account exists but is broken.
      return false;
    }
  }
}
