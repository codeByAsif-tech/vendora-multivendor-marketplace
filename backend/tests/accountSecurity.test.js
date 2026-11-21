import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { AuthToken } from '../src/models/authToken.model.js';
import { Session } from '../src/models/session.model.js';
import { User } from '../src/models/user.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createUser, PASSWORD } from './helpers/factories.js';

const API = '/api/v1';

beforeAll(connectTestDB);
beforeEach(() => {
  testOutbox.length = 0;
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

/** Token from the link in the last email sent to this address. */
function tokenFromEmail(to) {
  const mail = [...testOutbox].reverse().find((m) => m.to === to);
  return mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
}

const register = (email = 'ram@example.com') =>
  request(app).post(`${API}/auth/register`).send({ name: 'Ram Kumar', email, password: 'Passw0rd!1' });

describe('Email verification', () => {
  it('sends a link on sign-up; the link verifies the email once', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ emailVerified: false, emailVerifiedAt: null });

    const token = tokenFromEmail('ram@example.com');
    expect(token).toBeTruthy();
    // Only the hash is stored
    expect(await AuthToken.exists({ tokenHash: token })).toBeNull();

    const verified = await request(app).post(`${API}/auth/verify-email`).send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.data.user.emailVerified).toBe(true);
    expect((await User.findOne({ email: 'ram@example.com' })).emailVerifiedAt).toBeInstanceOf(Date);

    const again = await request(app).post(`${API}/auth/verify-email`).send({ token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('TOKEN_INVALID');
  });

  it('refuses expired and made-up links', async () => {
    await register();
    const token = tokenFromEmail('ram@example.com');
    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token })).body.code).toBe('TOKEN_INVALID');
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token: 'x'.repeat(43) })).status).toBe(400);
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token: 'bad token!' })).status).toBe(400);
  });

  it('resends a new link (old one stops working), with a cooldown, and not when already verified', async () => {
    const { auth, user } = await createUser('customer', { emailVerifiedAt: null });
    const url = `${API}/auth/verify-email/resend`;

    await request(app).post(url).set(auth).expect(200);
    const first = tokenFromEmail(user.email);

    const tooSoon = await request(app).post(url).set(auth);
    expect(tooSoon.status).toBe(429);

    await AuthToken.updateMany({}, { $set: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
    await request(app).post(url).set(auth).expect(200);
    const second = tokenFromEmail(user.email);
    expect(second).not.toBe(first);
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token: first })).status).toBe(400);
    await request(app).post(`${API}/auth/verify-email`).send({ token: second }).expect(200);

    const done = await request(app).post(url).set(auth);
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('ALREADY_VERIFIED');
  });
});

describe('Forgot and reset password', () => {
  it('gives the same answer for known and unknown emails, and only emails real accounts', async () => {
    const { user } = await createUser('customer');
    const known = await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email });
    const unknown = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(testOutbox.map((m) => m.to)).toEqual([user.email]);
  });

  it('sends nothing to a blocked account', async () => {
    const { user } = await createUser('customer', { status: 'blocked' });
    await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(200);
    expect(testOutbox).toHaveLength(0);
  });

  it('resets the password once, signs out every device and old access tokens', async () => {
    const { user, auth } = await createUser('customer', { emailVerifiedAt: null });
    // An existing signed-in session
    const login = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: PASSWORD });
    expect(login.status).toBe(200);

    await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(200);
    const token = tokenFromEmail(user.email);

    // Weak password is refused and does not use up the link
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'short' })).status).toBe(400);

    // Old access tokens were issued more than a second before the change
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reset = await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'BrandNew@99' });
    expect(reset.status).toBe(200);

    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'Another@77' })).body.code).toBe('TOKEN_INVALID');
    expect(await Session.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    expect((await request(app).get(`${API}/auth/me`).set(auth)).status).toBe(401);

    expect((await request(app).post(`${API}/auth/login`).send({ email: user.email, password: PASSWORD })).status).toBe(401);
    const fresh = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'BrandNew@99' });
    expect(fresh.status).toBe(200);
    // Opening the emailed link proved the mailbox: the email is verified too
    expect(fresh.body.data.user.emailVerified).toBe(true);
    expect((await request(app).get(`${API}/auth/me`).set({ Authorization: `Bearer ${fresh.body.data.accessToken}` })).status).toBe(200);

    expect(testOutbox.at(-1).subject).toMatch(/password was changed/i);
  });

  it('only the newest reset link works', async () => {
    const { user } = await createUser('customer');
    await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email });
    const first = tokenFromEmail(user.email);
    await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email });
    const second = tokenFromEmail(user.email);

    expect((await request(app).post(`${API}/auth/reset-password`).send({ token: first, password: 'BrandNew@99' })).status).toBe(400);
    await request(app).post(`${API}/auth/reset-password`).send({ token: second, password: 'BrandNew@99' }).expect(200);
  });
});
