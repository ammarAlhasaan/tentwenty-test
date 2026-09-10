import { Injectable } from '@nestjs/common';
import { isBillable } from '../analytics/cost-model.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_BILLABLE_CATEGORIES,
  DEFAULT_MONTHLY_OVERHEAD,
  type Settings,
  type UpdateSettingsBody,
  settingsSchema,
} from './settings.schema.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<Settings> {
    const rows = await this.prisma.setting.findMany();
    const stored = Object.fromEntries(rows.map((row) => [row.key, safeParse(row.value)]));

    // Parsed on every read, so a hand-edited row cannot put a bad value into the
    // cost model; anything invalid falls back to the assessment's default.
    const parsed = settingsSchema.safeParse({
      billableCategories: stored.billableCategories ?? DEFAULT_BILLABLE_CATEGORIES,
      monthlyOverhead: stored.monthlyOverhead ?? DEFAULT_MONTHLY_OVERHEAD,
    });

    return parsed.success
      ? parsed.data
      : {
          billableCategories: DEFAULT_BILLABLE_CATEGORIES,
          monthlyOverhead: DEFAULT_MONTHLY_OVERHEAD,
        };
  }

  /** Every category present in the loaded timesheet, so the UI can offer real choices. */
  async knownCategories(): Promise<{ category: string; billable: boolean; hours: number }[]> {
    const settings = await this.read();

    const rows = await this.prisma.timesheetEntry.groupBy({
      by: ['category'],
      _sum: { hours: true },
      orderBy: { _sum: { hours: 'desc' } },
    });

    return rows.map((row) => ({
      category: row.category,
      billable: isBillable(row.category, settings),
      hours: row._sum.hours ?? 0,
    }));
  }

  async update(patch: UpdateSettingsBody): Promise<Settings> {
    const writes = Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value: JSON.stringify(value) },
          update: { value: JSON.stringify(value) },
        }),
      );

    await this.prisma.$transaction(writes);
    return this.read();
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
