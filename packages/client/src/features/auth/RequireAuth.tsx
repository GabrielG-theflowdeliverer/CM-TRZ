import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStatus } from './useAuth';

/**
 * Editor gate. Wraps every authenticated route; the public respondent survey
 * (/s/:token) and the login page sit outside it. When the server runs without
 * auth, `authRequired` is false and this is transparent.
 */
export function RequireAuth() {
  const { data, isLoading, isError } = useAuthStatus();

  // Don't flash the app or the login screen before we know the session state.
  if (isLoading) return null;

  // If /me itself failed (server down), fall through to the app so its own
  // error surfaces, rather than trapping the user on a blank gate.
  if (!isError && data && data.authRequired && !data.authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
