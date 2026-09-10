import { Module, OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { DEFAULT_BILLABLE_CATEGORIES, DEFAULT_MONTHLY_OVERHEAD } from './settings.schema.js';
import { SettingsService } from './settings.service.js';

@Module({
  // SessionAuthGuard injects AuthService, and AuthModule is not global.
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // An empty `update` is insert-if-absent: a restart never resets a value the
    // user changed. (`createMany`'s skipDuplicates is not supported on SQLite.)
    const defaults = {
      billableCategories: DEFAULT_BILLABLE_CATEGORIES,
      monthlyOverhead: DEFAULT_MONTHLY_OVERHEAD,
    };

    for (const [key, value] of Object.entries(defaults)) {
      await this.prisma.setting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: {},
      });
    }
  }
}
