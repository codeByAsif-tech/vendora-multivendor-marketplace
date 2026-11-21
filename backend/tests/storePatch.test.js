import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { SellerProfile } from '../src/models/sellerProfile.model.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const patch = (auth, body) => request(app).patch(`${API}/seller/profile`).set(auth).send(body);
const exists = (publicId) => fs.access(path.join(env.uploadRoot, publicId)).then(() => true, () => false);

describe('PATCH /seller/profile', () => {
  it('changes only the fields sent and keeps everything else (incl. the bank account)', async () => {
    const seller = await createSeller('approved');
    const before = await SellerProfile.findById(seller.store._id).select('+bankAccountNumberEncrypted').lean();

    const res = await patch(seller.auth, { contactPhone: '+919812345678', pickupAddress: { city: 'Coimbatore' } });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Store details updated');
    // Short response: summary only, never the bank details or the full profile
    expect(Object.keys(res.body.data.store).sort()).toEqual(['_id', 'slug', 'status', 'storeName', 'updatedAt']);

    const after = await SellerProfile.findById(seller.store._id).select('+bankAccountNumberEncrypted').lean();
    expect(after.contactPhone).toBe('+919812345678');
    expect(after.pickupAddress).toMatchObject({ city: 'Coimbatore', line1: before.pickupAddress.line1, postalCode: before.pickupAddress.postalCode });
    expect(after).toMatchObject({ storeName: before.storeName, slug: before.slug, pan: before.pan, status: 'approved' });
    expect(after.bank).toEqual(before.bank);
    expect(after.bankAccountNumberEncrypted).toBe(before.bankAccountNumberEncrypted);
  });

  it('renames the store (new slug) and can replace the bank account number', async () => {
    const seller = await createSeller('approved');
    await patch(seller.auth, { storeName: 'Cotton Corner', bank: { accountNumber: '123456789012' } }).expect(200);
    const after = await SellerProfile.findById(seller.store._id).lean();
    expect(after).toMatchObject({ storeName: 'Cotton Corner', slug: 'cotton-corner', bank: { accountNumberLast4: '9012', ifsc: 'HDFC0001234' } });
  });

  it('a rejected store that changes a field is resubmitted', async () => {
    const seller = await createSeller('rejected');
    const res = await patch(seller.auth, { pan: 'ABCDE9999Z' });
    expect(res.body.message).toBe('Store resubmitted for review');
    expect((await SellerProfile.findById(seller.store._id)).status).toBe('pending');
  });

  it('validates what is sent, refuses empty or unknown fields, and needs a store', async () => {
    const seller = await createSeller('approved');
    expect((await patch(seller.auth, {})).status).toBe(400);
    expect((await patch(seller.auth, { contactPhone: '12' })).status).toBe(400);
    expect((await patch(seller.auth, { status: 'approved' })).status).toBe(400);

    const newSeller = await createUser('seller');
    const res = await patch(newSeller.auth, { contactPhone: '+919812345678' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STORE_NOT_FOUND');
  });
});

describe('PATCH /seller/profile/media', () => {
  it('changes only the image sent and can remove one', async () => {
    const seller = await createSeller('approved');
    const url = `${API}/seller/profile/media`;

    const both = await request(app)
      .patch(url)
      .set(seller.auth)
      .attach('logo', PNG, { filename: 'l.png', contentType: 'image/png' })
      .attach('banner', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(both.status).toBe(200);
    const { logo, banner } = both.body.data;
    expect(both.body.data.storeName).toBeUndefined(); // images only, not the whole store

    // Only the banner: logo stays the same, old banner file is cleaned up
    const onlyBanner = await request(app).patch(url).set(seller.auth).attach('banner', PNG, { filename: 'b2.png', contentType: 'image/png' });
    expect(onlyBanner.body.data.logo).toEqual(logo);
    expect(onlyBanner.body.data.banner.publicId).not.toBe(banner.publicId);

    // Remove the logo without uploading anything
    const removed = await request(app).patch(url).set(seller.auth).field('remove', 'logo');
    expect(removed.status).toBe(200);
    expect(removed.body.message).toBe('Image removed');
    expect(removed.body.data.logo).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50)); // file deletion runs in the background
    expect(await exists(logo.publicId)).toBe(false);
  });

  it('refuses nothing to do, a bad remove value, or uploading and removing the same image', async () => {
    const seller = await createSeller('approved');
    const url = `${API}/seller/profile/media`;
    expect((await request(app).patch(url).set(seller.auth).field('remove', 'photo')).status).toBe(400);
    expect((await request(app).patch(url).set(seller.auth).field('x', '1')).status).toBe(400);
    const clash = await request(app)
      .patch(url)
      .set(seller.auth)
      .field('remove', 'logo')
      .attach('logo', PNG, { filename: 'l.png', contentType: 'image/png' });
    expect(clash.status).toBe(400);
  });
});
