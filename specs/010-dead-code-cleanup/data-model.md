# Phase 1 Data Model: Dead Code and Cruft Cleanup

**Not applicable.**

This specification removes code and changes no data. Specifically:

- No Prisma model, field, index or relation is added, removed or altered.
- No migration is written. `prisma/migrations/` is untouched.
- No stored value changes shape or meaning.
- No request body or query parameter changes.

Two items in the spec touch data *descriptions* rather than data:

- **FR-010** corrects a frontend type so it matches the import-history response the backend
  already sends. The response itself does not change. Documented in
  [contracts/import-history.md](contracts/import-history.md).
- **FR-011** changes which rows produce an existing warning at import time. The warning's shape,
  its code, and the table it is derived from are all unchanged; only the predicate deciding
  whether a given ref code qualifies is corrected.

The `Employee` model was examined during the audit and is explicitly retained. It is written and
never read, but it carries the foreign keys that `Salary` and `TimesheetEntry` depend on, and
foreign-key enforcement is switched on at connection time.
