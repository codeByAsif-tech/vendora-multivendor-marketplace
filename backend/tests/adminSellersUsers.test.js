import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createSeller, createUser, PASSWORD } from './helpers/factories.js';

const API = '/api/v1';

let admin;

beforeAll(connectTestDB);
beforeEach(async () => {
  testOutbox.length = 0;
  admin = await createUser('admin');
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe('Admin: sellers', () => {
  it('lists sellers with status counts and filters by status', async () => {
    await createSeller('pending');
    await createSeller('pending');
    await createSeller('approved');

    const all = await request(app).get(`${API}/admin/sellers`).set(admin.auth);
    expect(all.status).toBe(200);
    expect(all.body.data.counts).toMatchObject({ all: 3, pending: 2, approved: 1, rejected: 0 });
    expect(all.body.data.items[0].user.email).toBeDefined();

    const pending = await request(app).get(`${API}/admin/sellers?status=pending`).set(admin.auth);
    expect(pending.body.data.items).toHaveLength(2);
    expect(pending.body.data.pagination).toMatchObject({ page: 1, total: 2 });
  });

  it('searches by store name or owner email', async () => {
    const { store, user } = await createSeller('pending');
    await createSeller('pending');

    const byStore = await request(app).get(`${API}/admin/sellers`).query({ search: store.storeName }).set(admin.auth);
    expect(byStore.body.data.items).toHaveLength(1);

    const byEmail = await request(app).get(`${API}/admin/sellers`).query({ search: user.email }).set(admin.auth);
    expect(byEmail.body.data.items).toHaveLength(1);
  });

  it('never exposes the encrypted bank account', async () => {
    const { store } = await createSeller('pending');
    const res = await request(app).get(`${API}/admin/sellers/${store._id}`).set(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.seller.bankAccountNumberEncrypted).toBeUndefined();
    expect(res.body.data.seller.bank.accountNumberLast4).toBe('6789');
  });

  it('approves a pending seller, records history and emails them', async () => {
    const { store, user } = await createSeller('pending');
    const res = await request(app)
      .patch(`${API}/admin/sellers/${store._id}/status`)
      .set(admin.auth)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.seller.status).toBe('approved');
    expect(res.body.data.seller.approvedAt).toBeDefined();
    expect(res.body.data.seller.statusHistory.at(-1).status).toBe('approved');
    expect(testOutbox.find((m) => m.to === user.email)?.subject).toMatch(/approved/i);
  });

  it('requires a reason to reject or suspend', async () => {
    const { store } = await createSeller('pending');
    const res = await request(app)
      .patch(`${API}/admin/sellers/${store._id}/status`)
      .set(admin.auth)
      .send({ status: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('reason');
  });

  it('stores the rejection reason for the seller to see', async () => {
    const { store } = await createSeller('pending');
    const res = await request(app)
      .patch(`${API}/admin/sellers/${store._id}/status`)
      .set(admin.auth)
      .send({ status: 'rejected', reason: 'PAN does not match business name' });

    expect(res.status).toBe(200);
    expect(res.body.data.seller.statusReason).toBe('PAN does not match business name');
  });

  it('suspends and reinstates an approved seller', async () => {
    const { store } = await createSeller('approved');
    const url = `${API}/admin/sellers/${store._id}/status`;

    const suspended = await request(app).patch(url).set(admin.auth).send({ status: 'suspended', reason: 'Policy violation' });
    expect(suspended.body.data.seller.status).toBe('suspended');

    const reinstated = await request(app).patch(url).set(admin.auth).send({ status: 'approved' });
    expect(reinstated.body.data.seller.status).toBe('approved');
    expect(reinstated.body.data.seller.statusReason).toBeUndefined();
    expect(testOutbox.at(-1).subject).toMatch(/reinstated/i);
  });

  it('rejects status changes that are not allowed', async () => {
    const { store } = await createSeller('pending');
    const res = await request(app)
      .patch(`${API}/admin/sellers/${store._id}/status`)
      .set(admin.auth)
      .send({ status: 'suspended', reason: 'Not allowed from pending' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('returns 404 for an unknown seller and 400 for a bad id', async () => {
    expect((await request(app).get(`${API}/admin/sellers/665f1c2e8b3a4c0012ab34cd`).set(admin.auth)).status).toBe(404);
    expect((await request(app).get(`${API}/admin/sellers/not-an-id`).set(admin.auth)).status).toBe(400);
  });

  it('is admin only', async () => {
    const { auth, store } = await createSeller('pending');
    const res = await request(app)
      .patch(`${API}/admin/sellers/${store._id}/status`)
      .set(auth)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });
});

describe('Admin: users', () => {
  it('lists customers by default with counts', async () => {
    await createUser('customer');
    await createUser('customer', { status: 'blocked' });
    await createUser('seller');

    const res = await request(app).get(`${API}/admin/users`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((u) => u.role === 'customer')).toBe(true);
    expect(res.body.data.items[0].password).toBeUndefined();
    expect(res.body.data.counts).toMatchObject({ all: 2, active: 1, blocked: 1 });
  });

  it('blocks a customer: signs them out everywhere and emails them', async () => {
    const { user, auth } = await createUser('customer');
    const login = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: PASSWORD });
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('refreshToken=')).split(';')[0];

    const res = await request(app)
      .patch(`${API}/admin/users/${user._id}/status`)
      .set(admin.auth)
      .send({ status: 'blocked', reason: 'Fraudulent activity' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('blocked');

    expect((await request(app).get(`${API}/auth/me`).set(auth)).status).toBe(403);
    expect((await request(app).post(`${API}/auth/refresh`).set('Cookie', cookie)).status).toBe(401);
    expect(testOutbox.find((m) => m.to === user.email)?.subject).toMatch(/blocked/i);
  });

  it('requires a reason to block', async () => {
    const { user } = await createUser('customer');
    const res = await request(app).patch(`${API}/admin/users/${user._id}/status`).set(admin.auth).send({ status: 'blocked' });
    expect(res.status).toBe(400);
  });

  it('reactivates a blocked user', async () => {
    const { user } = await createUser('customer', { status: 'blocked' });
    const res = await request(app).patch(`${API}/admin/users/${user._id}/status`).set(admin.auth).send({ status: 'active' });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('active');
  });

  it('cannot block admins or itself', async () => {
    const other = await createUser('admin');
    const blockOther = await request(app)
      .patch(`${API}/admin/users/${other.user._id}/status`)
      .set(admin.auth)
      .send({ status: 'blocked', reason: 'Testing admin block' });
    expect(blockOther.status).toBe(403);

    const blockSelf = await request(app)
      .patch(`${API}/admin/users/${admin.user._id}/status`)
      .set(admin.auth)
      .send({ status: 'blocked', reason: 'Testing self block' });
    expect(blockSelf.status).toBe(400);
  });
});

describe('Admin overview', () => {
  it('includes seller and product counts', async () => {
    await createSeller('pending');
    await createSeller('approved');

    const res = await request(app).get(`${API}/admin/overview`).set(admin.auth);
    expect(res.body.data).toMatchObject({ sellers: 2, pendingSellers: 1, approvedSellers: 1, products: 0 });
  });
});
