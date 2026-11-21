import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Address } from '../src/models/address.model.js';
import { Coupon, CouponRedemption } from '../src/models/coupon.model.js';
import { LedgerEntry, SellerWallet } from '../src/models/earnings.model.js';
import { Notification } from '../src/models/notification.model.js';
import { Order, SellerOrder } from '../src/models/order.model.js';
import { Payment } from '../src/models/payment.model.js';
import { Product } from '../src/models/product.model.js';
import { splitDiscount } from '../src/services/coupon.service.js';
import { publicName } from '../src/services/review.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let customer;
let admin;
let sellerA;
let sellerB;
let teeA; // ₹600
let mugB; // ₹400
let address;

beforeAll(connectTestDB);
beforeEach(async () => {
  const { leaf } = await createCategories();
  customer = await createUser('customer', { name: 'Ram Kumar' });
  admin = await createUser('admin');
  sellerA = await createSeller('approved');
  sellerB = await createSeller('approved');
  teeA = await createProduct(sellerA, leaf._id, { status: 'approved', name: 'Tee', slug: 'tee', variants: [{ sku: 'TEE-1', price: 60000, stock: 20 }] });
  mugB = await createProduct(sellerB, leaf._id, { status: 'approved', name: 'Mug', slug: 'mug', variants: [{ sku: 'MUG-1', price: 40000, stock: 20 }] });
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

const addToCart = (product, quantity = 1) =>
  request(app)
    .post(`${API}/cart/items`)
    .set(customer.auth)
    .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity });

async function checkout(paymentMethod = 'cod') {
  const res = await request(app)
    .post(`${API}/orders`)
    .set(customer.auth)
    .send({
      addressId: String(address._id),
      paymentMethod,
      ...(paymentMethod === 'manual' ? { utr: `UTR${crypto.randomInt(1e9, 9e9)}` } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  return res;
}

async function deliveredOrder(lines = [[teeA, 2]]) {
  for (const [product, qty] of lines) await addToCart(product, qty);
  const res = await checkout('cod');
  expect(res.status).toBe(201);
  const placed = res.body.data.order;
  for (const shipment of await SellerOrder.find({ order: placed._id })) {
    const seller = String(shipment.seller) === String(sellerA.user._id) ? sellerA : sellerB;
    for (const status of ['processing', 'shipped', 'delivered']) {
      await request(app).patch(`${API}/seller/orders/${shipment._id}/status`).set(seller.auth).send({ status }).expect(200);
    }
  }
  return placed;
}

/** Notifications are written in the background; wait until they appear. */
async function waitFor(check, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

const createCoupon = (body) => request(app).post(`${API}/admin/coupons`).set(admin.auth).send(body);

describe('Reviews', () => {
  it('only lets customers with a delivered order review, and keeps the product rating in sync', async () => {
    const url = `${API}/products/tee/reviews/me`;
    expect((await request(app).put(url).set(customer.auth).send({ rating: 5 })).status).toBe(403);

    await deliveredOrder();
    const state = await request(app).get(url).set(customer.auth);
    expect(state.body.data).toMatchObject({ canReview: true, review: null });

    const created = await request(app).put(url).set(customer.auth).send({ rating: 4, title: 'Soft cotton', body: 'Fits well.' });
    expect(created.status).toBe(201);
    expect(await Product.findById(teeA._id)).toMatchObject({ ratingAvg: 4, ratingCount: 1 });

    const edited = await request(app).put(url).set(customer.auth).send({ rating: 2 });
    expect(edited.status).toBe(200);
    expect((await Product.findById(teeA._id)).ratingAvg).toBe(2);

    const list = await request(app).get(`${API}/products/tee/reviews`);
    expect(list.body.data.summary).toMatchObject({ average: 2, count: 1, distribution: { 2: 1 } });
    expect(list.body.data.items[0]).toMatchObject({ author: 'Ram K.', verified: true });
    expect(list.body.data.items[0].user).toBeUndefined();
    expect(await waitFor(() => Notification.exists({ user: sellerA.user._id, type: 'new_review' }))).toBe(true);
  });

  it('admins can hide a review: it stops counting and the author is told', async () => {
    await deliveredOrder();
    await request(app).put(`${API}/products/tee/reviews/me`).set(customer.auth).send({ rating: 1, body: 'spam spam' });
    const { body } = await request(app).get(`${API}/admin/reviews`).set(admin.auth);
    const id = body.data.items[0]._id;

    expect((await request(app).patch(`${API}/admin/reviews/${id}`).set(admin.auth).send({ status: 'hidden' })).status).toBe(400);
    await request(app).patch(`${API}/admin/reviews/${id}`).set(admin.auth).send({ status: 'hidden', reason: 'Not about the product' }).expect(200);

    expect(await Product.findById(teeA._id)).toMatchObject({ ratingAvg: 0, ratingCount: 0 });
    expect((await request(app).get(`${API}/products/tee/reviews`)).body.data.items).toHaveLength(0);
    expect(await waitFor(() => Notification.exists({ user: customer.user._id, type: 'review_hidden' }))).toBe(true);
  });

  it('shows only a first name and initial', () => {
    expect(publicName('Ram Kumar Sharma')).toBe('Ram S.');
    expect(publicName('Asha')).toBe('Asha');
  });
});

describe('Coupons', () => {
  it('applies to the cart, discounts checkout, splits the discount over shipments and counts the use', async () => {
    await createCoupon({ code: 'save10', type: 'percent', value: 10, maxDiscount: 50000 }).expect(201);
    await addToCart(teeA); // ₹600
    await addToCart(mugB); // ₹400

    const applied = await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'SAVE10' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.summary).toMatchObject({ subtotal: 100000, discount: 10000, total: 90000 });
    expect(applied.body.data.coupon).toMatchObject({ code: 'SAVE10', discount: 10000, error: null });

    const res = await checkout('cod');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.order._id);
    expect(order).toMatchObject({ discountTotal: 10000, total: 90000, coupon: { code: 'SAVE10' } });

    const shipments = await SellerOrder.find({ order: order._id }).sort({ subtotal: -1 });
    expect(shipments.map((s) => s.discountShare)).toEqual([6000, 4000]);
    expect(shipments.map((s) => s.payable)).toEqual([54000, 36000]);
    // Platform pays for the coupon: seller earnings still use the full price
    expect(shipments[0].sellerEarning).toBe(54000);

    expect((await Payment.findOne({ order: order._id })).amount).toBe(90000);
    expect((await Coupon.findOne({ code: 'SAVE10' })).usedCount).toBe(1);

    // per-customer limit (default 1)
    await addToCart(teeA);
    const again = await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'save10' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('COUPON_INVALID');
  });

  it('explains why a coupon does not apply', async () => {
    await createCoupon({ code: 'BIG', type: 'fixed', value: 20000, minOrderValue: 100000 }).expect(201);
    await createCoupon({ code: 'OLD', type: 'fixed', value: 1000, endsAt: '2020-01-01' }).expect(201);
    await addToCart(teeA);

    const tooSmall = await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'BIG' });
    expect(tooSmall.body.message).toMatch(/Add items worth ₹400 more/);
    expect((await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'OLD' })).body.message).toMatch(/expired/);
    expect((await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'NOPE' })).status).toBe(400);
  });

  it('gives the use back when the whole order is cancelled', async () => {
    await createCoupon({ code: 'ONCE', type: 'fixed', value: 5000, usageLimit: 1 }).expect(201);
    await addToCart(teeA);
    await request(app).post(`${API}/cart/coupon`).set(customer.auth).send({ code: 'ONCE' }).expect(200);
    const placed = (await checkout('cod')).body.data.order;
    expect((await Coupon.findOne({ code: 'ONCE' })).usedCount).toBe(1);

    await request(app).post(`${API}/orders/${placed.orderNumber}/cancel`).set(customer.auth).send({ reason: 'Changed my mind' }).expect(200);
    expect((await Coupon.findOne({ code: 'ONCE' })).usedCount).toBe(0);
    expect(await CouponRedemption.countDocuments()).toBe(0);
  });

  it('splits rounding leftovers so shares always add up', () => {
    expect(splitDiscount(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(splitDiscount(0, [500, 500])).toEqual([0, 0]);
  });
});

describe('Returns', () => {
  it('request → approve → receive: stock back, refund due, seller earning reduced', async () => {
    const placed = await deliveredOrder([[teeA, 2]]);
    const shipment = await SellerOrder.findOne({ order: placed._id });
    const item = shipment.items[0];
    const stockBefore = (await Product.findById(teeA._id)).variants[0].stock;

    const requested = await request(app)
      .post(`${API}/orders/${placed.orderNumber}/returns`)
      .set(customer.auth)
      .send({ sellerOrderId: String(shipment._id), items: [{ itemId: String(item._id), quantity: 1 }], reason: 'size_fit' });
    expect(requested.status).toBe(201);
    const ret = requested.body.data.return;
    expect(ret).toMatchObject({ status: 'requested', itemsValue: 60000, refundAmount: 60000, sellerDebit: 54000 });

    // A second open return for the same shipment is refused
    const dup = await request(app)
      .post(`${API}/orders/${placed.orderNumber}/returns`)
      .set(customer.auth)
      .send({ sellerOrderId: String(shipment._id), items: [{ itemId: String(item._id), quantity: 1 }], reason: 'size_fit' });
    expect(dup.body.code).toBe('RETURN_ALREADY_OPEN');

    // Another seller cannot touch it
    expect((await request(app).patch(`${API}/seller/returns/${ret._id}`).set(sellerB.auth).send({ action: 'approve' })).status).toBe(404);

    await request(app).patch(`${API}/seller/returns/${ret._id}`).set(sellerA.auth).send({ action: 'approve' }).expect(200);
    await request(app).patch(`${API}/seller/returns/${ret._id}`).set(sellerA.auth).send({ action: 'receive' }).expect(200);

    expect((await Product.findById(teeA._id)).variants[0].stock).toBe(stockBefore + 1);
    expect((await SellerOrder.findById(shipment._id)).items[0].returnedQuantity).toBe(1);
    expect((await Payment.findOne({ order: placed._id })).refundDue).toBe(60000);
    expect(await LedgerEntry.findOne({ type: 'return' })).toMatchObject({ amount: -54000 });
    // ₹1080 earned on 2 tees (on hold) minus ₹540 returned
    expect(await SellerWallet.findOne({ store: sellerA.store._id })).toMatchObject({ onHold: 108000, available: -54000, totalEarned: 54000 });

    expect(await waitFor(() => Notification.exists({ user: customer.user._id, type: 'return_received' }))).toBe(true);
    expect(await waitFor(() => Notification.exists({ user: admin.user._id, type: 'refund_due' }))).toBe(true);
  });

  it('refuses returns of undelivered items, too many units, or after the window', async () => {
    await addToCart(teeA);
    const placed = (await checkout('cod')).body.data.order;
    const shipment = await SellerOrder.findOne({ order: placed._id });
    const body = (quantity) => ({
      sellerOrderId: String(shipment._id),
      items: [{ itemId: String(shipment.items[0]._id), quantity }],
      reason: 'size_fit',
    });
    const url = `${API}/orders/${placed.orderNumber}/returns`;

    expect((await request(app).post(url).set(customer.auth).send(body(1))).body.code).toBe('NOT_DELIVERED');

    await SellerOrder.updateOne({ _id: shipment._id }, { $set: { status: 'delivered', deliveredAt: new Date() } });
    expect((await request(app).post(url).set(customer.auth).send(body(2))).status).toBe(400);

    await SellerOrder.updateOne({ _id: shipment._id }, { $set: { deliveredAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) } });
    expect((await request(app).post(url).set(customer.auth).send(body(1))).body.code).toBe('RETURN_WINDOW_CLOSED');
  });

  it('needs details for a damaged item and a reason to decline', async () => {
    const placed = await deliveredOrder([[teeA, 1]]);
    const shipment = await SellerOrder.findOne({ order: placed._id });
    const url = `${API}/orders/${placed.orderNumber}/returns`;
    const base = { sellerOrderId: String(shipment._id), items: [{ itemId: String(shipment.items[0]._id), quantity: 1 }] };

    expect((await request(app).post(url).set(customer.auth).send({ ...base, reason: 'damaged' })).status).toBe(400);
    const ok = await request(app).post(url).set(customer.auth).send({ ...base, reason: 'damaged', details: 'The seam is torn on the left side.' });
    expect(ok.status).toBe(201);

    const id = ok.body.data.return._id;
    expect((await request(app).patch(`${API}/seller/returns/${id}`).set(sellerA.auth).send({ action: 'reject' })).status).toBe(400);
    await request(app).patch(`${API}/seller/returns/${id}`).set(sellerA.auth).send({ action: 'reject', note: 'Photo shows no damage' }).expect(200);
  });
});

describe('Notifications', () => {
  it('tells the seller about new orders and the customer about status changes; can be marked read', async () => {
    await deliveredOrder([[teeA, 1]]);
    expect(await waitFor(() => Notification.exists({ user: sellerA.user._id, type: 'new_order' }))).toBe(true);
    expect(await waitFor(async () => (await Notification.countDocuments({ user: customer.user._id, type: 'order_status' })) === 3)).toBe(true);

    const list = await request(app).get(`${API}/notifications`).set(customer.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.unreadCount).toBe(3);
    expect(list.body.data.items[0].user).toBeUndefined();

    const read = await request(app).patch(`${API}/notifications/${list.body.data.items[0]._id}/read`).set(customer.auth);
    expect(read.body.data.unreadCount).toBe(2);

    // Someone else's notification is not found
    expect((await request(app).patch(`${API}/notifications/${list.body.data.items[1]._id}/read`).set(sellerA.auth)).status).toBe(404);

    await request(app).post(`${API}/notifications/read-all`).set(customer.auth).expect(200);
    expect((await request(app).get(`${API}/notifications/unread-count`).set(customer.auth)).body.data.unreadCount).toBe(0);
  });
});
