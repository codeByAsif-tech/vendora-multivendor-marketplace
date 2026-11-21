import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';

const API = '/api/v1';

const customer = { name: 'Ram Kumar', email: 'ram@example.com', password: 'Secret@123' };

function getRefreshCookie(res) {
  const cookies = res.headers['set-cookie'] || [];
  return cookies.find((cookie) => cookie.startsWith('refreshToken='));
}

function cookiePair(setCookieHeader) {
  return setCookieHeader.split(';')[0];
}

async function createUser(overrides = {}) {
  return User.create({ ...customer, ...overrides });
}

async function loginAs(email, password = customer.password) {
  const res = await request(app).post(`${API}/auth/login`).send({ email, password });
  return { res, accessToken: res.body.data?.accessToken, cookie: getRefreshCookie(res) };
}

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe('POST /auth/register', () => {
  it('creates a customer, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(customer);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: customer.email, role: 'customer' });
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toBeTypeOf('string');

    const cookie = getRefreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('stores a bcrypt hash, never the plain password', async () => {
    await request(app).post(`${API}/auth/register`).send(customer);
    const user = await User.findOne({ email: customer.email }).select('+password');

    expect(user.password).not.toBe(customer.password);
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser();
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ ...customer, email: 'RAM@example.com' });

    expect(res.status).toBe(409);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ name: 'R', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('ignores attempts to self-assign the admin role', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ ...customer, role: 'admin' });

    // .strict() schema rejects unknown keys such as "role"
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ role: 'admin' })).toBe(0);
  });

  it('strips Mongo operators from the body (NoSQL injection)', async () => {
    await createUser();
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: { $gt: '' }, password: { $gt: '' } });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/register-seller', () => {
  it('creates a seller account', async () => {
    const res = await request(app)
      .post(`${API}/auth/register-seller`)
      .send({ ...customer, email: 'seller@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('seller');
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    await createUser();
    const { res, cookie } = await loginAs(customer.email);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(cookie).toBeDefined();
  });

  it('returns the same 401 message for wrong password and unknown email', async () => {
    await createUser();
    const wrongPassword = await loginAs(customer.email, 'Wrong1234');
    const unknownEmail = await loginAs('nobody@example.com');

    expect(wrongPassword.res.status).toBe(401);
    expect(unknownEmail.res.status).toBe(401);
    expect(wrongPassword.res.body.message).toBe(unknownEmail.res.body.message);
  });

  it('blocks login when the portal does not match the role', async () => {
    await createUser();
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: customer.email, password: customer.password, portal: 'admin' });

    expect(res.status).toBe(403);
  });

  it('blocks login for a blocked account', async () => {
    await createUser({ status: 'blocked' });
    const { res } = await loginAs(customer.email);

    expect(res.status).toBe(403);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user with a valid token', async () => {
    await createUser();
    const { accessToken } = await loginAs(customer.email);

    const res = await request(app)
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(customer.email);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with a tampered token', async () => {
    const res = await request(app)
      .get(`${API}/auth/me`)
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('returns 403 once the user is blocked, even with a still-valid token', async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(customer.email);
    await User.updateOne({ _id: user._id }, { status: 'blocked' });

    const res = await request(app)
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    await createUser();
    const { cookie } = await loginAs(customer.email);

    const res = await request(app).post(`${API}/auth/refresh`).set('Cookie', cookiePair(cookie));

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    const newCookie = getRefreshCookie(res);
    expect(cookiePair(newCookie)).not.toBe(cookiePair(cookie));
  });

  it('detects reuse of an old refresh token and revokes all sessions', async () => {
    await createUser();
    const { cookie: firstCookie } = await loginAs(customer.email);

    const rotated = await request(app)
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookiePair(firstCookie));
    const secondCookie = getRefreshCookie(rotated);

    // Attacker replays the first (already rotated) token
    const replay = await request(app)
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookiePair(firstCookie));
    expect(replay.status).toBe(401);

    // The legitimate newer token is now revoked too
    const afterReuse = await request(app)
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookiePair(secondCookie));
    expect(afterReuse.status).toBe(401);
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).post(`${API}/auth/refresh`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token', async () => {
    await createUser();
    const { cookie } = await loginAs(customer.email);

    const logout = await request(app).post(`${API}/auth/logout`).set('Cookie', cookiePair(cookie));
    expect(logout.status).toBe(200);

    const refresh = await request(app).post(`${API}/auth/refresh`).set('Cookie', cookiePair(cookie));
    expect(refresh.status).toBe(401);
  });
});

describe('Role-based access: GET /admin/overview', () => {
  it('allows an admin', async () => {
    await createUser({ email: 'admin@example.com', role: 'admin' });
    await createUser();
    const { accessToken } = await loginAs('admin@example.com');

    const res = await request(app)
      .get(`${API}/admin/overview`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customers: 1, admins: 1, sellers: 0 });
  });

  it.each(['customer', 'seller'])('returns 403 for a %s', async (role) => {
    await createUser({ role });
    const { accessToken } = await loginAs(customer.email);

    const res = await request(app)
      .get(`${API}/admin/overview`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${API}/admin/overview`);
    expect(res.status).toBe(401);
  });
});

describe('Unknown routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get(`${API}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
