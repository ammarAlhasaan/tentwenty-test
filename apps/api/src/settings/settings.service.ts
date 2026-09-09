import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  DEFAULT_BILLABLE_CATEGORIES,
  DEFAULT_MONTHLY_OVERHEAD,
  type Settings,
  type UpdateSettingsBody,
  settingsSchema,
} from './settings.schema.js';

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  read(): Settings {
    const rows = this.database.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
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
  knownCategories(): { category: string; billable: boolean; hours: number }[] {
    const billable = new Set(this.read().billableCategories.map((name) => name.toLowerCase()));
    const rows = this.database.db
      .prepare(
        'SELECT category, SUM(hours) AS hours FROM timesheet_entries GROUP BY category ORDER BY hours DESC',
      )
      .all() as { category: string; hours: number }[];

    return rows.map((row) => ({
      category: row.category,
      billable: billable.has(row.category.toLowerCase()),
      hours: row.hours,
    }));
  }

  update(patch: UpdateSettingsBody): Settings {
    const write = this.database.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );

    this.database.db.transaction(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) write.run(key, JSON.stringify(value));
      }
    })();

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
