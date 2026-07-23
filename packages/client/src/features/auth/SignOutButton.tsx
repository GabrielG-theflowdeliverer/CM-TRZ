import { useNavigate } from 'react-router-dom';
import { useAuthStatus, useLogout } from './useAuth';

/** Sign-out control. Renders nothing when the server runs without auth. */
export function SignOutButton() {
  const { data } = useAuthStatus();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!data?.authRequired) return null;

  return (
    <button
      type="button"
      className="cmt-btn-secondary"
      disabled={logout.isPending}
      onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
    >
      Sign out
    </button>
  );
}
