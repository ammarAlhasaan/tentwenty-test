import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { resolveDatabaseFile } from '../config.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    // Resolved to an absolute path before the adapter sees it: `pnpm -r dev`
    // from the repo root and `pnpm dev` from apps/api run with different cwds
    // and must still open the same file. prisma7.config.ts anchors the CLI the
    // same way, so migrations and the app never disagree.
    const file = resolveDatabaseFile(config.getOrThrow<string>('DATABASE_PATH'));
    mkdirSync(dirname(file), { recursive: true });

    super({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    // The only raw SQL left in the application. PRAGMAs are SQLite connection
    // settings with no Prisma equivalent, and the adapter exposes no hook for
    // them. `foreign_keys` is what makes the schema's relations actually
    // enforced; WAL matches the behaviour BE-01 established.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
