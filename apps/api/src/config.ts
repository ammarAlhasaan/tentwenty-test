import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/margin.sqlite'),
  // Normalised to a bare origin: browsers send `Origin` with no trailing slash
  // and no path, so `http://localhost:3000/` would start fine and then match
  // nothing in the CORS check.
  FRONTEND_ORIGIN: z
    .url({
      protocol: /^https?$/,
      error: 'Must be an http(s) origin, for example http://localhost:3000',
    })
    .transform((value) => new URL(value).origin)
    .default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

// Relative database paths are anchored to apps/api rather than to the working
// directory: `pnpm -r dev` from the repo root and `pnpm dev` from apps/api run
// with different cwds and must still open the same file.
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function resolveDatabaseFile(databasePath: string): string {
  return resolve(appDir, databasePath);
}
