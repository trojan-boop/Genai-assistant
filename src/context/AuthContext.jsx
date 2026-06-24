import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

/**
 * Wrap the app in this once, near the root. Children can call useAuth()
 * to read { user, isLoading, error } and call login/signup/logout.
 *
 * Because the JWT lives in an httpOnly cookie, the frontend can never read
 * it directly — "are we logged in" is answered by asking the backend via
 * GET /me, which succeeds if the cookie is present and valid. We do this
 * once on mount so a page refresh doesn't bounce a logged-in user to /login.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true until the initial /me check resolves
  const [error, setError] = useState(null);

  useEffect(() => {
    authApi
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const loggedInUser = await authApi.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      setError(err.detail || "Login failed");
      throw err;
    }
  }, []);

  const signup = useCallback(async (email, password) => {
    setError(null);
    try {
      const newUser = await authApi.signup(email, password);
      setUser(newUser);
      return newUser;
    } catch (err) {
      setError(err.detail || "Signup failed");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear local state even if the network call fails — the user's
      // intent is to leave the logged-in screen, and there's nothing left
      // to retry that would change that decision.
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
