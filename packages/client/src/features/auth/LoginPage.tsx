import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useLogin } from './useAuth';

/** The single-editor sign-in screen. Respondents and share viewers never see this. */
export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  const error =
    login.error instanceof ApiError && login.error.status === 401
      ? 'Incorrect password.'
      : login.error
        ? 'Could not sign in — please try again.'
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        className="cmt-card w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate(password, { onSuccess: () => navigate('/', { replace: true }) });
        }}
      >
        <div>
          <h1 className="text-lg font-bold">Change Management Tool</h1>
          <p className="text-sm text-slate-500">Sign in to continue.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            className="cmt-input w-full"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" className="cmt-btn w-full" disabled={!password || login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
