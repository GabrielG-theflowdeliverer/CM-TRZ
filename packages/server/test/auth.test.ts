import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/infra/db.js';
import { createApp } from '../src/app.js';
import { hashPassword, type AuthConfig } from '../src/infra/auth.js';

const PASSWORD = 'correct-horse-battery-staple';

function authedApp() {
  const db = openDb(':memory:');
  const auth: AuthConfig = {
    sessionSecret: 'test-session-secret',
    passwordHash: hashPassword(PASSWORD),
    secure: false,
    ttlSeconds: 3600,
  };
  return createApp(db, { auth });
}

describe('editor authentication', () => {
  it('401s editor routes without a session cookie', async () => {
    await request(authedApp()).get('/api/projects').expect(401);
  });

  it('rejects a wrong password and accepts the right one, then grants access', async () => {
    const agent = request.agent(authedApp());
    await agent.post('/api/auth/login').send({ password: 'wrong' }).expect(401);

    const login = await agent.post('/api/auth/login').send({ password: PASSWORD }).expect(204);
    expect(login.headers['set-cookie']?.[0]).toMatch(/cmt_session=/);

    // The persisted cookie now authorises editor routes.
    await agent.get('/api/projects').expect(200);
  });

  it('reports auth state via /me and clears it on logout', async () => {
    const agent = request.agent(authedApp());
    const before = await agent.get('/api/auth/me').expect(200);
    expect(before.body).toEqual({ authenticated: false, authRequired: true });

    await agent.post('/api/auth/login').send({ password: PASSWORD }).expect(204);
    const after = await agent.get('/api/auth/me').expect(200);
    expect(after.body.authenticated).toBe(true);

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/projects').expect(401);
  });

  it('leaves public token routes reachable without authentication', async () => {
    const app = authedApp();
    // An unknown token is a 404 from the survey/share handlers — crucially NOT a 401.
    await request(app).get('/api/survey/nope').expect((res) => expect(res.status).not.toBe(401));
    await request(app).get('/api/share/nope').expect((res) => expect(res.status).not.toBe(401));
    await request(app).get('/api/health').expect(200);
  });

  it('throttles repeated login attempts (429 after the limit)', async () => {
    const app = authedApp();
    // The limiter allows 10 attempts per window; the 11th is blocked.
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/login').send({ password: 'wrong' }).expect(401);
    }
    await request(app).post('/api/auth/login').send({ password: PASSWORD }).expect(429);
  });

  it('runs the API open when no auth is configured', async () => {
    const app = createApp(openDb(':memory:')); // no auth
    await request(app).get('/api/projects').expect(200);
    const me = await request(app).get('/api/auth/me').expect(200);
    expect(me.body).toEqual({ authenticated: true, authRequired: false });
  });
});
