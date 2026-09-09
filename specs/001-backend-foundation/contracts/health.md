# Contract: `GET /health`

**Status**: existing endpoint, preserved unchanged by BE-01 (spec FR-025).
Source: `apps/api/src/app.controller.ts`.

## Request

```
GET /health
```

No authentication, no parameters, no request body. No schema is attached to any parameter, so the
globally registered `StandardSchemaValidationPipe` skips this route entirely.

## Response — 200 OK

```json
{ "status": "ok" }
```

`content-type: application/json`.

## Notes

- This is the **only** endpoint BE-01 exposes (spec SC-010). No test, debug, or error-triggering
  route is added (spec FR-030).
- It returns 200 as long as the process is listening. It does not probe the database: BE-01 opens
  the connection at startup and fails startup if it cannot, so a running process already implies a
  usable connection. Adding a database probe would be unverified extra behaviour with no
  requirement behind it.
- Cross-origin behaviour applies to this route like any other — see
  [errors.md](./errors.md) for the error contract and the plan for the CORS configuration.
