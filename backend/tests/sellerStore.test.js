import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { SellerProfile } from '../src/models/sellerProfile.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { decrypt } from '../src/utils/crypto.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createSeller, createUser, storeInput } from './helpers/factories.js';

const API = '/api/v1';

beforeAll(connectTestDB);
beforeEach(() => {
  testOutbox.length = 0;
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe('Seller store profile', () => {
  it('returns null before the store is created', async () => {
    const { auth } = await createUser('seller');
    const res = await request(app).get(`${API}/seller/profile`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.store).toBeNull();
  });

  it('submits a new store as pending, encrypts the bank account and emails the seller', async () => {
    const { user, auth } = await createUser('seller');
    const res = await request(app).put(`${API}/seller/profile`).set(auth).send(storeInput());

    expect(res.status).toBe(201);
    const { store } = res.body.data;
    expect(store).toMatchObject({ storeName: 'Urban Threads', slug: 'urban-threads', status: 'pending' });
    // The save response is a short summary: no bank details at all (GET /seller/profile has the full store).
    expect(store.bank).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('50100123456789');
    expect(store.bankAccountNumberEncrypted).toBeUndefined();

    const saved = await SellerProfile.findOne({ user: user._id }).select('+bankAccountNumberEncrypted');
    expect(saved.bank.accountNumberLast4).toBe('6789');
    expect(saved.bankAccountNumberEncrypted).not.toContain('50100123456789');
    expect(decrypt(saved.bankAccountNumberEncrypted)).toBe('50100123456789');

    expect(testOutbox.map((m) => m.to)).toContain(user.email);
  });

  it('requires the bank account number on first submission', async () => {
    const { auth } = await createUser('seller');
    const input = storeInput();
    input.bank.accountNumber = '';

    const res = await request(app).put(`${API}/seller/profile`).set(auth).send(input);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('bank.accountNumber');
  });

  it('keeps the saved account number when it is left empty on update', async () => {
    const { user, auth } = await createUser('seller');
    await request(app).put(`${API}/seller/profile`).set(auth).send(storeInput());

    const input = storeInput({ description: 'Updated' });
    input.bank.accountNumber = '';
    const res = await request(app).put(`${API}/seller/profile`).set(auth).send(input);

    expect(res.status).toBe(200);
    const saved = await SellerProfile.findOne({ user: user._id }).select('+bankAccountNumberEncrypted');
    expect(decrypt(saved.bankAccountNumberEncrypted)).toBe('50100123456789');
    expect(saved.description).toBe('Updated');
  });

  it('rejects invalid PAN, IFSC and PIN code', async () => {
    const { auth } = await createUser('seller');
    const input = storeInput({ pan: 'BAD' });
    input.bank.ifsc = 'XYZ';
    input.pickupAddress.postalCode = '12';

    const res = await request(app).put(`${API}/seller/profile`).set(auth).send(input);
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['pan', 'bank.ifsc', 'pickupAddress.postalCode']));
  });

  it('does not allow two stores with the same name', async () => {
    const first = await createUser('seller');
    const second = await createUser('seller');
    await request(app).put(`${API}/seller/profile`).set(first.auth).send(storeInput());

    const res = await request(app)
      .put(`${API}/seller/profile`)
      .set(second.auth)
      .send(storeInput({ storeName: 'URBAN threads' }));

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('storeName');
  });

  it('resubmits a rejected store as pending', async () => {
    const { auth, store } = await createSeller('rejected');
    const res = await request(app)
      .put(`${API}/seller/profile`)
      .set(auth)
      .send(storeInput({ storeName: store.storeName }));

    expect(res.status).toBe(201);
    expect(res.body.data.store.status).toBe('pending');
  });

  it('keeps an approved store approved when details change', async () => {
    const { auth, store } = await createSeller('approved');
    const res = await request(app)
      .put(`${API}/seller/profile`)
      .set(auth)
      .send(storeInput({ storeName: store.storeName, description: 'New text' }));

    expect(res.status).toBe(200);
    expect(res.body.data.store.status).toBe('approved');
  });

  it('is not available to customers or admins', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');

    expect((await request(app).get(`${API}/seller/profile`).set(customer.auth)).status).toBe(403);
    expect((await request(app).put(`${API}/seller/profile`).set(admin.auth).send(storeInput())).status).toBe(403);
  });
});

describe('Approved-seller gate', () => {
  it.each([
    ['pending', 'STORE_PENDING'],
    ['rejected', 'STORE_REJECTED'],
    ['suspended', 'STORE_SUSPENDED'],
  ])('blocks product creation for a %s store', async (status, code) => {
    const { auth } = await createSeller(status);
    const res = await request(app).post(`${API}/seller/products`).set(auth).send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(code);
  });

  it('asks sellers without a store to create one', async () => {
    const { auth } = await createUser('seller');
    const res = await request(app).post(`${API}/seller/products`).set(auth).send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STORE_PROFILE_REQUIRED');
  });
});
