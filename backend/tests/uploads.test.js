import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

// Smallest buffers that pass the magic-byte check.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(async () => {
  await disconnectTestDB();
  await fs.rm(env.uploadRoot, { recursive: true, force: true });
});

describe('Product image upload', () => {
  it('uploads images into the seller’s own folder', async () => {
    const { auth, user } = await createSeller('approved');
    const res = await request(app)
      .post(`${API}/seller/uploads/product-images`)
      .set(auth)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', JPG, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    const { images } = res.body.data;
    expect(images).toHaveLength(2);
    expect(images[0].publicId.startsWith(`marketplace/products/${user._id}/`)).toBe(true);
    expect(images[0].publicId).toMatch(/\.png$/);
    expect(images[1].publicId).toMatch(/\.jpg$/);

    const saved = await fs.readFile(path.join(env.uploadRoot, images[0].publicId));
    expect(saved.equals(PNG)).toBe(true);

    // Served back with safe headers
    const served = await request(app).get(images[0].url);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects a file whose content is not an image even if it claims to be', async () => {
    const { auth } = await createSeller('approved');
    const res = await request(app)
      .post(`${API}/seller/uploads/product-images`)
      .set(auth)
      .attach('images', Buffer.from('<script>alert(1)</script> not an image'), {
        filename: 'evil.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid/i);
  });

  it('rejects disallowed types such as SVG', async () => {
    const { auth } = await createSeller('approved');
    const res = await request(app)
      .post(`${API}/seller/uploads/product-images`)
      .set(auth)
      .attach('images', Buffer.from('<svg></svg>'), { filename: 'x.svg', contentType: 'image/svg+xml' });

    expect(res.status).toBe(400);
  });

  it('rejects more than 8 files', async () => {
    const { auth } = await createSeller('approved');
    let req = request(app).post(`${API}/seller/uploads/product-images`).set(auth);
    for (let i = 0; i < 9; i += 1) {
      req = req.attach('images', PNG, { filename: `${i}.png`, contentType: 'image/png' });
    }
    const res = await req;
    expect(res.status).toBe(400);
  });

  it('requires an approved seller', async () => {
    const pending = await createSeller('pending');
    const customer = await createUser('customer');

    const send = (auth) =>
      request(app)
        .post(`${API}/seller/uploads/product-images`)
        .set(auth)
        .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect((await send(pending.auth)).status).toBe(403);
    expect((await send(customer.auth)).status).toBe(403);
  });
});

describe('Store logo upload', () => {
  it('sets the store logo', async () => {
    const { auth } = await createSeller('pending');
    const res = await request(app)
      .put(`${API}/seller/profile/media`)
      .set(auth)
      .attach('logo', PNG, { filename: 'logo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.logo.url).toMatch(/^\/uploads\/marketplace\/stores\//);
  });
});
