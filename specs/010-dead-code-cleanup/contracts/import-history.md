# Contract: `GET /imports`

**Status**: existing endpoint. This change does not alter it. The document records what it
actually returns, so the frontend type can be corrected against a written reference rather than
against a reading of the service.

## Response

```jsonc
{
  "imports": [
    {
      "id": 12,
      "kind": "timesheet",              // "timesheet" | "salaries" | "projects"
      "filename": "timesheet-2025.xlsx",
      "uploadedAt": "2026-09-10T08:14:22.031Z",
      "uploadedBy": "demo@tentwenty.local",   // null when the user record is gone
      "rowsAccepted": 1420,
      "periodsReplaced": [
        { "year": 2025, "month": 1, "label": "Jan 2025" }
      ],
      "warningCount": 3
    }
  ],
  "loaded": {
    "timesheet": true,
    "salaries": true,
    "projects": false
  }
}
```

## Drift being corrected

The frontend type describing this response is wrong in two directions.

| Field | Endpoint sends | Frontend declares | Action |
|---|---|---|---|
| `rowsSkipped` | no | `rowsSkipped?: number` | **Remove from the type.** Optional, so the compiler never objected; the value is always `undefined` at runtime. |
| `warnings` | no | `warnings?: { code, message }[]` | **Remove from the type.** Same — always `undefined`. |
| `warningCount` | yes | not declared | **Leave undeclared.** Nothing renders it. |
| `loaded` | yes | not declared | **Leave undeclared.** Nothing reads it. |

The two undeclared fields stay undeclared deliberately. Declaring surface with no consumer is the
same defect as declaring surface with no producer. Whether the endpoint should keep sending them
is a separate decision, recorded in the spec's Out of Scope.

## Not to be confused with

`ImportResult`, the response to the three upload endpoints, is a different shape and is correct as
declared. It does carry `rowsSkipped` and `warnings`, both required and both rendered by the
upload card. Only the **history** row shape is wrong.
