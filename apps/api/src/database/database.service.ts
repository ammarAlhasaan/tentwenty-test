import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { resolveDatabaseFile } from '../config.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection?: Database.Database;

  constructor(private readonly config: ConfigService) {}

  get db(): Database.Database {
    if (!this.connection) throw new Error('Database connection is not open');
    return this.connection;
  }

  onModuleInit(): void {
    const file = resolveDatabaseFile(this.config.getOrThrow<string>('DATABASE_PATH'));

    try {
      mkdirSync(dirname(file), { recursive: true });
      this.connection = new Database(file);
    } catch (cause) {
      throw new Error(`Cannot open database at ${file}`, { cause });
    }

    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');
  }

  onModuleDestroy(): void {
    this.connection?.close();
    this.connection = undefined;
  }
}
