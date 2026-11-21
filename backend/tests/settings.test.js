import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let admin;
let customer;
let cheap; // ₹200, below the default ₹499 free-delivery threshold

beforeAll(connectTestDB);
beforeEach(async () => {
  const { leaf } = await createCategories();
  admin = await createUser('admin');
  customer = await createUser('customer');
  const seller = await createSeller('approved');
  cheap = await createProduct(seller, leaf._id, { status: 'approved', variants: [{ sku: 'C-1', price: 20000, stock: 10 }] });
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const save = (auth, body) => request(app).put(`${API}/admin/settings`).set(auth).send(body);
const cart = () => request(app).get(`${API}/cart`).set(customer.auth);

describe('Platform settings', () => {
  it('has working defaults and a public read-only view', async () => {
    const res = await request(app).get(`${API}/settings`);
    expect(res.status).toBe(200);
    expect(res.body.data.settings.shipping).toEqual({ fee: 4900, freeThreshold: 49900, firstOrderFree: true });
    expect(res.body.data.settings.readOnly).toBeUndefined();
  });

  it('delivery fee, threshold and the first-order offer drive the cart', async () => {
    await request(app)
      .post(`${API}/cart/items`)
      .set(customer.auth)
      .send({ productId: String(cheap._id), variantId: String(cheap.variants[0]._id), quantity: 1 });

    // Default: first order ships free
    expect((await cart()).body.data.summary).toMatchObject({ shipping: 0, firstOrderFreeDelivery: true });

    // Turn the offer off and change the fee
    const res = await save(admin.auth, { shipping: { firstOrderFree: false, fee: 7900 } });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.shipping).toEqual({ fee: 7900, freeThreshold: 49900, firstOrderFree: false });
    expect((await cart()).body.data.summary).toMatchObject({ shipping: 7900, firstOrderFreeDelivery: false, shippingRule: { fee: 7900 } });

    // Lower the free threshold below the cart value: free again
    await save(admin.auth, { shipping: { freeThreshold: 10000 } }).expect(200);
    expect((await cart()).body.data.summary.shipping).toBe(0);
  });

  it('saves one section without touching the others', async () => {
    await save(admin.auth, { announcement: { message: 'Diwali sale: 10% off with DIWALI10' } }).expect(200);
    await save(admin.auth, { support: { email: 'Help@Vendora.in' } }).expect(200);
    const { settings } = (await request(app).get(`${API}/admin/settings`).set(admin.auth)).body.data;
    expect(settings.announcement.message).toBe('Diwali sale: 10% off with DIWALI10');
    expect(settings.support.email).toBe('help@vendora.in');
    expect(settings.shipping.fee).toBe(4900);
    expect(settings.readOnly).toMatchObject({ earningsHoldDays: 7 });
  });

  it('validates input and is admin only', async () => {
    expect((await save(admin.auth, {})).status).toBe(400);
    expect((await save(admin.auth, { shipping: { fee: -1 } })).status).toBe(400);
    expect((await save(admin.auth, { announcement: { message: 'x'.repeat(141) } })).status).toBe(400);
    expect((await save(admin.auth, { maintenance: true })).status).toBe(400);
    expect((await save(customer.auth, { shipping: { fee: 0 } })).status).toBe(403);
  });
});
