-- Baseline: the schema BE-03 created at runtime, before Prisma.
-- An existing database already matches this and is marked applied with
-- `prisma migrate resolve --applied 0_init`; a fresh database gets it from
-- `prisma migrate deploy`. Migration 1 then brings both to the shape
-- prisma/schema.prisma describes.

CREATE TABLE "users" (
    "id"            INTEGER PRIMARY KEY AUTOINCREMENT,
    "email"         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    "password_hash" TEXT NOT NULL,
    "created_at"    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE "sessions" (
    "sid"        TEXT PRIMARY KEY,
    "data"       TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL
);

CREATE INDEX "idx_sessions_expires_at" ON "sessions" ("expires_at");

CREATE TABLE "employees" (
    "employee_no" TEXT PRIMARY KEY,
    "name"        TEXT NOT NULL
);

CREATE TABLE "salaries" (
    "employee_no" TEXT NOT NULL REFERENCES "employees" ("employee_no"),
    "year"        INTEGER NOT NULL,
    "month"       INTEGER NOT NULL,
    "amount"      REAL NOT NULL,
    PRIMARY KEY ("employee_no", "year", "month")
);

CREATE TABLE "projects" (
    "ref_code"    TEXT PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "price"       REAL,
    "sales_year"  INTEGER,
    "sales_month" INTEGER,
    "category"    TEXT,
    "status"      TEXT
);

CREATE TABLE "timesheet_entries" (
    "id"              INTEGER PRIMARY KEY AUTOINCREMENT,
    "year"            INTEGER NOT NULL,
    "month"           INTEGER NOT NULL,
    "employee_no"     TEXT NOT NULL REFERENCES "employees" ("employee_no"),
    "employee_name"   TEXT NOT NULL,
    "type_of_expense" TEXT,
    "department"      TEXT NOT NULL,
    "designation"     TEXT,
    "category"        TEXT NOT NULL,
    "ref_code"        TEXT NOT NULL,
    "task_name"       TEXT,
    "company_name"    TEXT,
    "description"     TEXT,
    "hours"           REAL NOT NULL
);

CREATE INDEX "idx_timesheet_period"   ON "timesheet_entries" ("year", "month");
CREATE INDEX "idx_timesheet_ref"      ON "timesheet_entries" ("ref_code");
CREATE INDEX "idx_timesheet_employee" ON "timesheet_entries" ("employee_no", "year", "month");

CREATE TABLE "imports" (
    "id"            INTEGER PRIMARY KEY AUTOINCREMENT,
    "kind"          TEXT NOT NULL,
    "filename"      TEXT NOT NULL,
    "uploaded_at"   TEXT NOT NULL,
    "uploaded_by"   INTEGER REFERENCES "users" ("id"),
    "rows_accepted" INTEGER NOT NULL,
    "periods"       TEXT NOT NULL,
    "warnings"      TEXT NOT NULL
);

CREATE TABLE "settings" (
    "key"   TEXT PRIMARY KEY,
    "value" TEXT NOT NULL
);
