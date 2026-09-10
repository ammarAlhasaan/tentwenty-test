import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// This file sits in apps/api, so anchoring here gives the CLI the same absolute
// database path the running API resolves from DATABASE_PATH -- migrations and
// the app never disagree about which file they mean, whatever the cwd.
const databaseFile = resolve(import.meta.dirname, process.env.DATABASE_PATH ?? './data/margin.sqlite');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: `file:${databaseFile}` },
});
