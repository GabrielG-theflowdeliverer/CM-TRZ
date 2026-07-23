import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { LoginPage } from './LoginPage';
import { RequireAuth } from './RequireAuth';
import type { AuthStatus } from './useAuth';

afterEach(() => vi.restoreAllMocks());

function mockMe(status: AuthStatus) {
  return vi.spyOn(api, 'get').mockResolvedValue(status);
}

describe('LoginPage', () => {
  it('posts the password and lands on home on success', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(undefined);
    renderWithClient(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/auth/login', { password: 'hunter2' }));
    await screen.findByText('Home');
  });

  it('shows an error on a wrong password', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError(401, 'Incorrect password'));
    renderWithClient(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument();
  });
});

describe('RequireAuth', () => {
  function renderGate() {
    return renderWithClient(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/secret" element={<div>Protected</div>} />
          </Route>
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('redirects to /login when unauthenticated', async () => {
    mockMe({ authenticated: false, authRequired: true });
    renderGate();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });

  it('renders the protected route when authenticated', async () => {
    mockMe({ authenticated: true, authRequired: true });
    renderGate();
    expect(await screen.findByText('Protected')).toBeInTheDocument();
  });

  it('is transparent when the server has no auth configured', async () => {
    mockMe({ authenticated: true, authRequired: false });
    renderGate();
    expect(await screen.findByText('Protected')).toBeInTheDocument();
  });
});
