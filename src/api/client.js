const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Thrown for any non-2xx response. Components can check `status` to decide
 * how to react (e.g. 401 -> redirect to login, 400 -> show inline message).
 */
export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Thin wrapper around fetch that:
 *  - always sends/receives the httpOnly auth cookie (credentials: 'include')
 *  - resolves the API base URL once, in one place
 *  - normalizes error responses into ApiError so callers don't each
 *    re-implement res.ok checks and JSON parsing of FastAPI's error shape
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body &&
      !(options.body instanceof URLSearchParams) &&
      !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      // FastAPI error shape is usually { detail: "..." } or
      // { detail: [{ msg: "...", ... }] } for validation errors.
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail.map((d) => d.msg).join(", ");
      }
    } catch {
      /* response had no JSON body — fall back to statusText */
    }
    throw new ApiError(detail, res.status, detail);
  }

  // /chat/stream returns a raw stream, not JSON — callers handle res.body
  // themselves, so let them opt out of the automatic .json() parse.
  if (options.rawResponse) return res;

  // Some endpoints (e.g. /logout) may return no body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
