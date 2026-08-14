import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { Session } from '../../src/app/modules/auth/auth.model.js';

const BASE = '/api/v1/auth';

const credentials = {
  name: 'Sajjad Mahmud',
  email: 'sajjad@example.com',
  password: 'correct-horse-battery',
};

const cookiesFrom = (headers: Record<string, unknown>): string[] => {
  const raw = headers['set-cookie'];

  return Array.isArray(raw) ? (raw as string[]) : [];
};

const cookieNamed = (headers: Record<string, unknown>, name: string): string | undefined =>
  cookiesFrom(headers).find((cookie) => cookie.startsWith(`${name}=`));

const registerUser = async (overrides: Partial<typeof credentials> = {}) =>
  request(app)
    .post(`${BASE}/register`)
    .send({ ...credentials, ...overrides });

describe('POST /auth/register', () => {
  it('creates an account and sets both auth cookies', async () => {
    const response = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: { name: credentials.name, email: credentials.email },
    });

    expect(cookieNamed(response.headers, 'access_token')).toBeDefined();
    expect(cookieNamed(response.headers, 'refresh_token')).toBeDefined();
  });

  it('never returns the password hash', async () => {
    const response = await registerUser();

    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('marks the cookies httpOnly so script cannot read them', async () => {
    const response = await registerUser();

    for (const name of ['access_token', 'refresh_token']) {
      expect(cookieNamed(response.headers, name)).toMatch(/HttpOnly/i);
    }
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser();
    const response = await registerUser({ name: 'Someone Else' });

    expect(response.status).toBe(409);
    expect(response.body.errorMessages[0].path).toBe('email');
  });

  it('reports every invalid field with its path', async () => {
    const response = await request(app)
      .post(`${BASE}/register`)
      .send({ name: '', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');

    const paths = response.body.errorMessages.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('accepts an email typed with padding and different casing', async () => {
    const response = await registerUser({ email: '  Sajjad@Example.COM  ' });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('sajjad@example.com');
  });
});

describe('POST /auth/login', () => {
  it('signs in with correct credentials', async () => {
    await registerUser();

    const response = await request(app)
      .post(`${BASE}/login`)
      .send({ email: credentials.email, password: credentials.password });

    expect(response.status).toBe(200);
    expect(cookieNamed(response.headers, 'access_token')).toBeDefined();
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await registerUser();

    const wrongPassword = await request(app)
      .post(`${BASE}/login`)
      .send({ email: credentials.email, password: 'not-the-password' });

    const unknownEmail = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'nobody@example.com', password: credentials.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);

    // Identical wording, so the endpoint cannot be used to enumerate accounts.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe('GET /auth/me', () => {
  it('rejects an anonymous request', async () => {
    const response = await request(app).get(`${BASE}/me`);

    expect(response.status).toBe(401);
  });

  it('rejects a token that was not signed by this server', async () => {
    const response = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', 'Bearer not.a.real.token');

    expect(response.status).toBe(401);
  });

  it('returns the signed-in user from the cookie', async () => {
    const registered = await registerUser();

    const response = await request(app)
      .get(`${BASE}/me`)
      .set('Cookie', cookiesFrom(registered.headers));

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(credentials.email);
  });
});

describe('POST /auth/refresh', () => {
  it('issues a new pair of tokens', async () => {
    const registered = await registerUser();

    const response = await request(app)
      .post(`${BASE}/refresh`)
      .set('Cookie', cookiesFrom(registered.headers));

    expect(response.status).toBe(200);
    expect(cookieNamed(response.headers, 'refresh_token')).toBeDefined();
  });

  it('still works when the same token is replayed moments later', async () => {
    const registered = await registerUser();
    const originalCookies = cookiesFrom(registered.headers);

    const first = await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookies);
    expect(first.status).toBe(200);

    // A second tab, or a request already in flight, still holding the cookie the
    // first exchange replaced. Treating this as theft would sign people out
    // during ordinary use.
    const replay = await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookies);
    expect(replay.status).toBe(200);
  });

  it('revokes every session when a token is replayed long after it was exchanged', async () => {
    const registered = await registerUser();
    const originalCookies = cookiesFrom(registered.headers);

    const rotated = await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookies);
    expect(rotated.status).toBe(200);

    // Age the exchange past the grace window rather than waiting for it.
    await Session.updateMany({}, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });

    const replay = await request(app).post(`${BASE}/refresh`).set('Cookie', originalCookies);
    expect(replay.status).toBe(401);

    // The token from the legitimate rotation is dead too: a leak was assumed
    // and every session for the user was dropped.
    const afterRevocation = await request(app)
      .post(`${BASE}/refresh`)
      .set('Cookie', cookiesFrom(rotated.headers));

    expect(afterRevocation.status).toBe(401);
  });

  it('rejects a request with no refresh cookie', async () => {
    const response = await request(app).post(`${BASE}/refresh`);

    expect(response.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('ends the session so the refresh token stops working', async () => {
    const registered = await registerUser();
    const cookies = cookiesFrom(registered.headers);

    const loggedOut = await request(app).post(`${BASE}/logout`).set('Cookie', cookies);
    expect(loggedOut.status).toBe(200);

    const afterLogout = await request(app).post(`${BASE}/refresh`).set('Cookie', cookies);
    expect(afterLogout.status).toBe(401);
  });
});

describe('error handling', () => {
  it('forwards rejected promises from async handlers to the error handler', async () => {
    // Nothing wraps handlers in try/catch. This asserts Express 5 does it,
    // which is the reason no catchAsync helper exists in this codebase.
    const response = await request(app).post(`${BASE}/register`).send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns a structured 404 for an unknown route', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, message: 'Route not found' });
  });

  it('reports health with the database state', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'connected' });
  });
});
