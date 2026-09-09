import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseService } from '../database/database.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

// Added alongside the authentication tables, never over them: an existing
// database keeps its users and sessions, so upgrading needs no file deletion.
//
// `salaries.amount` is NOT NULL on purpose. A blank cell is skipped rather than
// stored, so "no row" is the one unambiguous way to say "unknown" and 0 always
// means a genuine zero salary.
//
// There is no foreign key from timesheet_entries to projects: a ref code with
// hours and no price is an expected state, not an import failure.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS employees (
    employee_no TEXT PRIMARY KEY,
    name        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS salaries (
    employee_no TEXT NOT NULL REFERENCES employees (employee_no),
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    amount      REAL NOT NULL,
    PRIMARY KEY (employee_no, year, month)
  );

  CREATE TABLE IF NOT EXISTS projects (
    ref_code    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    price       REAL,
    sales_year  INTEGER,
    sales_month INTEGER,
    category    TEXT,
    status      TEXT
  );

  CREATE TABLE IF NOT EXISTS timesheet_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    employee_no     TEXT NOT NULL REFERENCES employees (employee_no),
    employee_name   TEXT NOT NULL,
    type_of_expense TEXT,
    department      TEXT NOT NULL,
    designation     TEXT,
    category        TEXT NOT NULL,
    ref_code        TEXT NOT NULL,
    task_name       TEXT,
    company_name    TEXT,
    description     TEXT,
    hours           REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_timesheet_period   ON timesheet_entries (year, month);
  CREATE INDEX IF NOT EXISTS idx_timesheet_ref      ON timesheet_entries (ref_code);
  CREATE INDEX IF NOT EXISTS idx_timesheet_employee ON timesheet_entries (employee_no, year, month);

  CREATE TABLE IF NOT EXISTS imports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    kind          TEXT NOT NULL,
    filename      TEXT NOT NULL,
    uploaded_at   TEXT NOT NULL,
    uploaded_by   INTEGER REFERENCES users (id),
    rows_accepted INTEGER NOT NULL,
    periods       TEXT NOT NULL,
    warnings      TEXT NOT NULL
  );
`;

@Module({
  imports: [
    // SessionAuthGuard injects AuthService, and AuthModule is not global.
    AuthModule,
    SettingsModule,
    // No storage option, so multer keeps the file in memory and hands us a
    // Buffer -- nothing is written to disk and there is nothing to clean up.
    // Nest maps multer's LIMIT_FILE_SIZE to a 413 on its own.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: config.getOrThrow<number>('MAX_UPLOAD_BYTES'), files: 1 },
      }),
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.database.db.exec(SCHEMA);
  }
}
