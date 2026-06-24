import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Gate for routes that require a logged-in user. Shows nothing meaningful
 * while the initial /me check is in flight (avoids a flash of the login
 * page for users who are actually already authenticated), then redirects
 * to /login if there's no user, preserving the page they tried to reach
 * so we can send them back after a successful login.
 */
export function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="auth-check-spinner" aria-label="Checking session" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
