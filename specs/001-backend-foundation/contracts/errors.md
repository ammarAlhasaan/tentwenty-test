# Contract: Error responses

Every non-2xx response from `apps/api` uses this one shape, produced by the single global filter
at `apps/api/src/common/http-exception.filter.ts` (spec FR-010).

This contract is consumed by `apps/web` and by BE-02/BE-03. It is duplicated on the frontend side
rather than shared, per Constitution Principle IV.

## Shape

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email: Invalid email address"],
  "path": "/some/route",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

| Field | Type | Always present | Meaning |
|---|---|---|---|
| `statusCode` | number | yes | HTTP status, identical to the response status |
| `error` | string | yes | Standard reason phrase for that status |
| `message` | string[] | yes | Human-readable detail. **Always an array**, even for a single message, so consumers need no type check |
| `path` | string | yes | Request URL the failure occurred on |
| `timestamp` | string | yes | ISO 8601, UTC |

The field set is identical across all three error classes below (spec SC-004). That is the part
consumers may depend on.

## Class 1 — Validation failure → 400

Raised by `StandardSchemaValidationPipe` before the handler runs (spec FR-008). `message` lists
one entry per failed input, each prefixed with its path.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["month: Expected number, received string", "year: Required"],
  "path": "/example",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

Not logged at error level (spec FR-014).

## Class 2 — Known error with a status → that status

Any `HttpException` a handler raises — `NotFoundException`, `ForbiddenException`,
`ConflictException`, and so on. The original status is preserved (spec FR-011).

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": ["Project not found"],
  "path": "/projects/999",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

Not logged at error level (spec FR-014).

## Class 3 — Unexpected error → 500

Anything that is not an `HttpException`: a thrown `Error`, a rejected promise, a `better-sqlite3`
failure.

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": ["Internal server error"],
  "path": "/example",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

The body is built from constants only — no field of the thrown value is read into it. There is
therefore no stack trace, file path, SQL string, internal exception message, or configuration
value in the response, in any environment (spec FR-012, SC-005).

The full error **including its stack** is written to the server log at error level via the Nest
`Logger` (spec FR-013, SC-006). This is the only class that logs.

## Not covered

- Responses after headers are already sent: the failure is logged and the process stays up; no
  body can be rewritten at that point.
- CORS rejections are enforced by the browser from missing response headers, not by this filter,
  so they produce no body of this shape.
