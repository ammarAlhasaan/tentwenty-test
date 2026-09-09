import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveDatabaseFile } from '../config.js';
import { DatabaseService } from './database.service.js';

let dir: string;

function serviceFor(databasePath: string) {
  const config = { getOrThrow: () => databasePath } as unknown as ConfigService;
  return new DatabaseService(config);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'be01-db-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('DatabaseService', () => {
  it('creates the file, and any missing parent directory, at the path it resolved', () => {
    const configured = join(dir, 'nested', 'deeper', 'margin.sqlite');
    const service = serviceFor(configured);

    service.onModuleInit();

    expect(existsSync(resolveDatabaseFile(configured))).toBe(true);
    service.onModuleDestroy();
  });

  it('persists data written through the service after it closes', () => {
    const configured = join(dir, 'margin.sqlite');

    const first = serviceFor(configured);
    first.onModuleInit();
    first.db.exec('CREATE TABLE probe (value TEXT)');
    first.db.prepare('INSERT INTO probe VALUES (?)').run('survived');
    first.onModuleDestroy();

    // Re-open independently: proves the bytes reached the configured file,
    // not just that the original handle still had them in memory.
    const reopened = new Database(resolveDatabaseFile(configured));
    expect(reopened.prepare('SELECT value FROM probe').all()).toEqual([{ value: 'survived' }]);
    reopened.close();
  });

  it('closes the connection on shutdown', () => {
    const service = serviceFor(join(dir, 'margin.sqlite'));
    service.onModuleInit();
    const connection = service.db;

    service.onModuleDestroy();

    expect(connection.open).toBe(false);
    expect(() => connection.prepare('SELECT 1')).toThrow();
    expect(() => service.db).toThrow('Database connection is not open');
  });

  it('enables WAL and foreign keys', () => {
    const service = serviceFor(join(dir, 'margin.sqlite'));
    service.onModuleInit();

    expect(service.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(service.db.pragma('foreign_keys', { simple: true })).toBe(1);
    service.onModuleDestroy();
  });

  it('fails startup with the path in the message when the file cannot be opened', () => {
    // A directory can never be opened as a database file.
    const service = serviceFor(dir);
    expect(() => service.onModuleInit()).toThrow(new RegExp(`Cannot open database at .*${dir}`));
  });
});
