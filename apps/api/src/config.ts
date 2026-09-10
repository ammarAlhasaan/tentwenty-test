import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Shipped so `cp .env.example .env` with no edits produces a running API. It is
// rejected in production by the refinement below, which is what keeps a
// published secret from ever signing a real session cookie.
const DEVELOPMENT_SESSION_SECRET = 'development-only-session-secret-change-me';

export const envSchema = z
  .object({
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
    SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SESSION_SECRET),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
    // Enforced by multer before the upload is buffered, so an oversized file is
    // refused without ever being held in memory.
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .default(10 * 1024 * 1024),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEVELOPMENT_SESSION_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message:
          'SESSION_SECRET must be set to a real secret in production. Generate one with: openssl rand -base64 48',
      });
    }
  });

// Relative database paths are anchored to apps/api rather than to the working
// directory: `pnpm -r dev` from the repo root and `pnpm dev` from apps/api run
// with different cwds and must still open the same file.
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function resolveDatabaseFile(databasePath: string): string {
  return resolve(appDir, databasePath);
}

// The three supplied workbooks, tracked in the repository so a clean checkout
// can load sample data. `appDir` resolves to apps/api from both src/ and dist/.
export function resolveSampleDataFile(filename: string): string {
  return resolve(appDir, 'sample-data', filename);
}
