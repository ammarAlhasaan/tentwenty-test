import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service.js';

export type User = { id: number; email: string };

@Injectable()
export class AuthService {
  // Verified against when no account matches, so a wrong password and an unknown
  // email take comparable time. Without it the unknown-email path would skip
  // Argon2id entirely and return in a fraction of the time, which is enough to
  // enumerate accounts with a stopwatch. Built once, from a random password
  // nobody holds, rather than being a hard-coded string.
  private dummyHash?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  }

  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });

    const matches = await this.safeVerify(row?.passwordHash ?? (await this.getDummyHash()), password);

    if (!row || !matches) return null;
    return { id: row.id, email: row.email };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }

  async createUser(email: string, password: string): Promise<void> {
    await this.prisma.user.create({
      data: {
        // Lowercased here rather than relying on a NOCASE column: the address is
        // already lowercased on the way in, and one rule in one place is easier
        // to follow than a collation Prisma cannot express.
        email: email.toLowerCase(),
        passwordHash: await hash(password),
        createdAt: timestamp(),
      },
    });
  }

  countUsers(): Promise<number> {
    return this.prisma.user.count();
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

/** SQLite's own `datetime('now')` shape, so old and new rows read alike. */
function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
