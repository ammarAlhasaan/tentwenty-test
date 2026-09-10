import { z } from 'zod';

/**
 * Only needed when a salary workbook uses bare month names and states no year
 * of its own. Sent as a multipart text field, hence the coercion.
 */
export const salaryUploadSchema = z
  .object({ year: z.coerce.number().int().min(1900).max(9999).optional() })
  .strict();

export type SalaryUploadBody = z.infer<typeof salaryUploadSchema>;
