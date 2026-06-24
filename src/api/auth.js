import { apiFetch } from "./client";

/**
 * /login expects application/x-www-form-urlencoded (FastAPI's
 * OAuth2PasswordRequestForm), not JSON — everything else in this API is JSON.
 */
export function login(email, password) {
  const body = new URLSearchParams({ username: email, password });
  return apiFetch("/login", { method: "POST", body });
}

export function signup(email, password) {
  return apiFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch("/logout", { method: "POST" });
}

/** Returns the current user if the session cookie is valid, throws ApiError(401) otherwise. */
export function fetchCurrentUser() {
  return apiFetch("/me");
}
