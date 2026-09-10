import { z } from 'zod';

export const DEFAULT_BILLABLE_CATEGORIES = ['Projects', 'Enhancements', 'Hosting'];
export const DEFAULT_MONTHLY_OVERHEAD = 0;

const billableCategories = z
  .array(z.string().trim().min(1).max(100))
  .min(1, 'At least one billable category is required')
  .refine(
    (values) => new Set(values.map((v) => v.toLowerCase())).size === values.length,
    'Categories must not repeat',
  );

// A finite, non-negative figure: Infinity or NaN here would propagate into
// every cost in the period.
const monthlyOverhead = z.number().finite().min(0);

export const settingsSchema = z.object({ billableCategories, monthlyOverhead });

export const updateSettingsSchema = z
  .object({ billableCategories: billableCategories.optional(), monthlyOverhead: monthlyOverhead.optional() })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
