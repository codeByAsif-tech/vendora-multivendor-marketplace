import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Address } from '../src/models/address.model.js';
import { SellerOrder } from '../src/models/order.model.js';
import { buildWindow } from '../src/services/analytics.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let customer;
let admin;
let sellerA;
let sellerB;
let teeA; // ₹600
let mugB; // ₹700
let address;

beforeAll(connectTestDB);
beforeEach(async () => {
  const { leaf } = await createCategories();
  customer = await createUser('customer');
  admin = await createUser('admin');
  sellerA = await createSeller('approved');
  sellerB = await createSeller('approved');
  teeA = await createProduct(sellerA, leaf._id, { status: 'approved', name: 'Tee', variants: [{ sku: 'TEE-1', price: 60000, stock: 50 }] });
  mugB = await createProduct(sellerB, leaf._id, { status: 'approved', name: 'Mug', variants: [{ sku: 'MUG-1', price: 70000, stock: 50 }] });
  address = await Address.create({
    user: customer.user._id,
    fullName: 'Ram Kumar',
    phone: '+919876543210',
    line1: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    isDefault: true,
  });
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

async function placeCodOrder(lines) {
  for (const [product, quantity] of lines) {
    await request(app)
      .post(`${API}/cart/items`)
      .set(customer.auth)
      .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity });
  }
  const res = await request(app)
    .post(`${API}/orders`)
    .set(customer.auth)
    .send({ addressId: String(address._id), paymentMethod: 'cod', idempotencyKey: crypto.randomUUID() });
  expect(res.status).toBe(201);
  return res.body.data.order;
}

describe('Report window', () => {
  it('builds one bucket per day / month, oldest first, in Indian time', () => {
    const now = new Date('2026-11-20T20:00:00Z'); // 21 Nov 01:30 IST
    const week = buildWindow('7d', now);
    expect(week.keys).toHaveLength(7);
    expect(week.keys.at(-1)).toBe('2026-11-21');
    expect(week.keys[0]).toBe('2026-11-15');
    expect(week.from.toISOString()).toBe('2026-11-14T18:30:00.000Z'); // 15 Nov 00:00 IST

    const year = buildWindow('12m', now);
    expect(year.keys).toHaveLength(12);
    expect(year.keys[0]).toBe('2025-12');
    expect(year.keys.at(-1)).toBe('2026-11');
  });
});

describe('Admin analytics', () => {
  it('reports sales, orders, top products and sellers, ignoring cancelled shipments', async () => {
    await placeCodOrder([[teeA, 2], [mugB, 1]]); // ₹1200 + ₹700
    const second = await placeCodOrder([[mugB, 1]]); // ₹700, then cancelled
    const cancelled = await SellerOrder.findOne({ order: second._id });
    await request(app)
      .patch(`${API}/seller/orders/${cancelled._id}/status`)
      .set(sellerB.auth)
      .send({ status: 'cancelled', reason: 'Out of stock' })
      .expect(200);

    const res = await request(app).get(`${API}/admin/analytics?range=7d`).set(admin.auth);
    expect(res.status).toBe(200);
    const { report } = res.body.data;

    expect(report.totals).toMatchObject({ sales: 190000, orders: 1, units: 3, shipments: 3, cancelled: 1, avgOrderValue: 190000 });
    expect(report.totals.cancelRate).toBeCloseTo(33.3);
    expect(report.totals.commission).toBe(12000 + 7000); // 10% of item subtotals
    expect(report.series).toHaveLength(7);
    expect(report.series.at(-1)).toMatchObject({ sales: 190000, orders: 1 });
    expect(report.statuses).toMatchObject({ confirmed: 2, cancelled: 1 });
    expect(report.payments).toEqual([{ method: 'cod', shipments: 2, amount: 190000 }]);
    expect(report.topProducts[0]).toMatchObject({ name: 'Tee', units: 2, revenue: 120000 });
    expect(report.topSellers.map((s) => s.storeName)).toEqual([sellerA.store.storeName, sellerB.store.storeName]);
    expect(report.signups.customers).toBe(1);
    expect(report.previous.sales).toBe(0);
  });

  it('rejects unknown ranges and non-admins', async () => {
    expect((await request(app).get(`${API}/admin/analytics?range=5y`).set(admin.auth)).status).toBe(400);
    expect((await request(app).get(`${API}/admin/analytics`).set(sellerA.auth)).status).toBe(403);
  });
});

describe('Seller analytics', () => {
  it('only counts the seller’s own shipments', async () => {
    await placeCodOrder([[teeA, 2], [mugB, 1]]);

    const res = await request(app).get(`${API}/seller/analytics?range=30d`).set(sellerA.auth);
    expect(res.status).toBe(200);
    const { report } = res.body.data;
    expect(report.totals).toMatchObject({ sales: 120000, orders: 1, units: 2, earnings: 108000 });
    expect(report.topProducts.map((p) => p.name)).toEqual(['Tee']);
    expect(report.topSellers).toBeUndefined();
    expect(report.series).toHaveLength(30);
  });
});
