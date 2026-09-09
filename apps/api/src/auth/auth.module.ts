import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export const DEMO_USER_EMAIL = 'demo@tentwenty.local';
export const DEMO_USER_PASSWORD = 'demo-password-2026';

// Tables are created with IF NOT EXISTS at startup rather than by a migration
// framework: there is no deployed database to evolve, and the two tables below
// do not change shape. Changing a column means deleting the database file.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
`;

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.database.db.exec(SCHEMA);

    // Clears sessions that expired while the process was down. Opportunistic
    // deletion in the store handles the rest, so no timer is needed.
    this.database.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());

    await this.seedDemoUser();
  }

  private async seedDemoUser(): Promise<void> {
    // Never in production, and never over an existing user table -- which is
    // what makes running this on every start idempotent.
    if (this.config.getOrThrow<string>('NODE_ENV') === 'production') return;
    if (this.auth.countUsers() > 0) return;

    await this.auth.createUser(DEMO_USER_EMAIL, DEMO_USER_PASSWORD);

    // The email only. The password is in apps/api/README.md, not in the log.
    this.logger.log(`Seeded demo user ${DEMO_USER_EMAIL} (password is in apps/api/README.md)`);
  }
}
