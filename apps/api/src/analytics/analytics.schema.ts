import { z } from 'zod';

export const periodQuerySchema = z
  .object({
    year: z.coerce.number().int().min(1900).max(9999),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .strict();

export type PeriodQuery = z.infer<typeof periodQuerySchema>;
