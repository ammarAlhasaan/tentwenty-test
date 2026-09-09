/**
 * The one way `apps/web` talks to `apps/api`.
 *
 * Transport only: no routing, no React, no notifications, no cache access.
 * Endpoint functions live with the feature that owns them.
 */

// Inlined at build time by Next.js, so a deployment that changes the API origin
// needs a rebuild. The fallback is the documented local origin of `apps/api`.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Duplicated from `apps/api`'s error contract; nothing is imported across the boundary. */
export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string[];
  path: string;
  timestamp: string;
};

export class ApiError extends Error {
  /** `"network"` means `fetch` itself rejected, so there is no status to reason about. */
  readonly kind: "http" | "network";
  readonly status: number | null;
  readonly messages: string[];
  readonly body: ApiErrorBody | null;

  constructor(init: {
    kind: "http" | "network";
    status: number | null;
    messages: string[];
    body?: ApiErrorBody | null;
  }) {
    super(init.messages[0] ?? "Request failed");
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.messages = init.messages;
    this.body = init.body ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * A cancelled request is deliberately not an `ApiError`: it is not a failure to
 * report, it is the caller's own doing.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ApiErrorBody).message) &&
    typeof (value as ApiErrorBody).statusCode === "number"
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  let messages: string[] | null = null;

  try {
    const text = await response.text();
    if (text) {
      const parsed: unknown = JSON.parse(text);
      if (isApiErrorBody(parsed)) {
        body = parsed;
        messages = parsed.message;
      }
    }
  } catch {
    // A proxy's HTML page, a truncated body, a gateway's plain text: reading the
    // detail failed, but the status is still a usable answer, so this must not
    // become a second error on top of the first.
  }

  return new ApiError({
    kind: "http",
    status: response.status,
    messages: messages?.length
      ? messages
      : [response.statusText || `Request failed with status ${response.status}`],
    body,
  });
}

export type ApiRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, except `FormData`, which is passed through untouched. */
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiFetch<T>(
  path: string,
  request: ApiRequest = {},
): Promise<T> {
  const { method = "GET", body, signal } = request;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json" };
  // A FormData body carries a boundary the browser generates and writes into
  // Content-Type. Setting that header here would replace it and the request
  // would arrive unparseable.
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
      // The session is a cross-origin HttpOnly cookie; without this the browser
      // does not attach it. Set here so no caller can forget it.
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError({
      kind: "network",
      status: null,
      messages: ["Could not reach the service."],
    });
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
