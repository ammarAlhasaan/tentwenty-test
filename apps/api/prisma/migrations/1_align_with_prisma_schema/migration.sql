-- Brings the baseline to the shape prisma/schema.prisma describes.
-- SQLite declares a non-INTEGER PRIMARY KEY nullable and "email" carried
-- COLLATE NOCASE; Prisma expresses neither. Tables are rebuilt in place with
-- INSERT..SELECT, so every existing row is carried across.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "employee_no" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
INSERT INTO "new_employees" ("employee_no", "name") SELECT "employee_no", "name" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE TABLE "new_projects" (
    "ref_code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" REAL,
    "sales_year" INTEGER,
    "sales_month" INTEGER,
    "category" TEXT,
    "status" TEXT
);
INSERT INTO "new_projects" ("category", "name", "price", "ref_code", "sales_month", "sales_year", "status") SELECT "category", "name", "price", "ref_code", "sales_month", "sales_year", "status" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE TABLE "new_sessions" (
    "sid" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL
);
INSERT INTO "new_sessions" ("data", "expires_at", "sid") SELECT "data", "expires_at", "sid" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");
CREATE TABLE "new_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
INSERT INTO "new_settings" ("key", "value") SELECT "key", "value" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);
INSERT INTO "new_users" ("created_at", "email", "id", "password_hash") SELECT "created_at", "email", "id", "password_hash" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

