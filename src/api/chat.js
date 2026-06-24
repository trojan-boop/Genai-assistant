import { apiFetch, ApiError } from "./client";

export function sendMessage(sessionId, message) {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export function fetchHistory(sessionId) {
  return apiFetch(`/chat/${sessionId}`);
}

/**
 * Returns the raw Response so the caller can read the stream chunk-by-chunk.
 * Throws ApiError if the initial request itself fails (e.g. 401, 500) before
 * any streaming begins.
 */
export async function streamMessage(sessionId, message, { useDocuments = false } = {}) {
  return apiFetch("/chat/stream", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      message,
      use_documents: useDocuments,
    }),
    rawResponse: true,
  });
}

export { ApiError };
