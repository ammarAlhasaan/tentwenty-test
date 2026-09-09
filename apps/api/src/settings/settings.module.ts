import { Module, OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseService } from '../database/database.service.js';
import { SettingsController } from './settings.controller.js';
import { DEFAULT_BILLABLE_CATEGORIES, DEFAULT_MONTHLY_OVERHEAD } from './settings.schema.js';
import { SettingsService } from './settings.service.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

@Module({
  // SessionAuthGuard injects AuthService, and AuthModule is not global.
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.database.db.exec(SCHEMA);

    // INSERT OR IGNORE, so a restart never resets a value the user changed.
    const seed = this.database.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    seed.run('billableCategories', JSON.stringify(DEFAULT_BILLABLE_CATEGORIES));
    seed.run('monthlyOverhead', JSON.stringify(DEFAULT_MONTHLY_OVERHEAD));
  }
}
