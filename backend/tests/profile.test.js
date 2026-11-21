import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Session } from '../src/models/session.model.js';
import { User } from '../src/models/user.model.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createUser, PASSWORD } from './helpers/factories.js';

const API = '/api/v1';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe('Own profile', () => {
  it('any role can change their name and phone, not their email or role', async () => {
    const admin = await createUser('admin');
    const res = await request(app).patch(`${API}/auth/me`).set(admin.auth).send({ name: 'Asha Rao', phone: '+919812345678' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: 'Asha Rao', phone: '+919812345678', role: 'admin' });

    expect((await request(app).patch(`${API}/auth/me`).set(admin.auth).send({ phone: '' })).body.data.user.phone).toBeUndefined();
    expect((await request(app).patch(`${API}/auth/me`).set(admin.auth).send({ email: 'x@example.com' })).status).toBe(400);
    expect((await request(app).patch(`${API}/auth/me`).set(admin.auth).send({ role: 'customer' })).status).toBe(400);
    expect((await request(app).patch(`${API}/auth/me`).set(admin.auth).send({})).status).toBe(400);
    expect((await User.findById(admin.user._id)).email).toBe(admin.user.email);
  });

  it('needs to be signed in', async () => {
    expect((await request(app).patch(`${API}/auth/me`).send({ name: 'Nobody' })).status).toBe(401);
  });
});

describe('Change password', () => {
  it('checks the current password, signs out other devices and keeps this one signed in', async () => {
    const { user, auth } = await createUser('seller');
    const otherDevice = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: PASSWORD });
    expect(otherDevice.status).toBe(200);

    const wrong = await request(app).post(`${API}/auth/change-password`).set(auth).send({ currentPassword: 'nope', newPassword: 'BrandNew@99' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0].field).toBe('currentPassword');

    const same = await request(app).post(`${API}/auth/change-password`).set(auth).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);

    await new Promise((resolve) => setTimeout(resolve, 1100)); // old tokens: more than a second older
    const res = await request(app).post(`${API}/auth/change-password`).set(auth).send({ currentPassword: PASSWORD, newPassword: 'BrandNew@99' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.join(';')).toMatch(/refreshToken=/);

    // Old access token stops working; the new one works
    expect((await request(app).get(`${API}/auth/me`).set(auth)).status).toBe(401);
    expect((await request(app).get(`${API}/auth/me`).set({ Authorization: `Bearer ${res.body.data.accessToken}` })).status).toBe(200);
    // Only this device's new session is left
    expect(await Session.countDocuments({ user: user._id, revokedAt: null })).toBe(1);
    expect((await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'BrandNew@99' })).status).toBe(200);
  });
});
