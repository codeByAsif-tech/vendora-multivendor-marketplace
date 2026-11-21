import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Address } from '../src/models/address.model.js';
import { Cart } from '../src/models/cart.model.js';
import { Order, SellerOrder } from '../src/models/order.model.js';
import { Payment } from '../src/models/payment.model.js';
import { Product } from '../src/models/product.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { deriveOrderStatus } from '../src/utils/orderStatus.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let customer;
let sellerA;
let sellerB;
let teeA; // seller A, ₹300, stock 5 → shipping fee applies (below ₹499)
let mugB; // seller B, ₹600, stock 3 → free shipping
let address;

beforeAll(connectTestDB);
beforeEach(async () => {
  testOutbox.length = 0;
  const { leaf } = await createCategories();
  customer = await createUser('customer');
  sellerA = await createSeller('approved');
  sellerB = await createSeller('approved');
  teeA = await createProduct(sellerA, leaf._id, { status: 'approved', name: 'Tee', variants: [{ sku: 'TEE-1', price: 30000, stock: 5 }] });
  mugB = await createProduct(sellerB, leaf._id, { status: 'approved', name: 'Mug', variants: [{ sku: 'MUG-1', price: 60000, stock: 3 }] });
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

const addToCart = (product, quantity = 1, auth = customer.auth) =>
  request(app)
    .post(`${API}/cart/items`)
    .set(auth)
    .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity });

const placeOrder = (body = {}, auth = customer.auth) =>
  request(app)
    .post(`${API}/orders`)
    .set(auth)
    .send({ addressId: String(address._id), paymentMethod: 'cod', idempotencyKey: crypto.randomUUID(), ...body });

const stockOf = async (product) => (await Product.findById(product._id)).variants[0].stock;

/** Gives the customer an earlier delivered order, so the "first order ships free" rule no longer applies. */
const seedPastOrder = () =>
  Order.create({
    orderNumber: 'MK000000000001',
    customer: customer.user._id,
    shippingAddress: { fullName: 'Ram Kumar', phone: '+919876543210', line1: 'x', city: 'x', state: 'x', postalCode: '560001' },
    itemCount: 1,
    subtotal: 10000,
    shippingTotal: 0,
    total: 10000,
    payment: { method: 'cod', status: 'paid' },
    status: 'delivered',
    idempotencyKey: 'seeded-past-order',
  });

describe('Cart', () => {
  it('adds items and calculates totals with per-store shipping', async () => {
    await seedPastOrder();
    await addToCart(teeA, 1);
    const res = await addToCart(mugB, 1);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.summary).toMatchObject({ itemCount: 2, subtotal: 90000, shipping: 4900, total: 94900 });
    expect(res.body.data.shipments).toHaveLength(2);
    expect(res.body.data.items[0].sellerId).toBeUndefined();
  });

  it('merges the same variant and caps the quantity at stock', async () => {
    await addToCart(mugB, 2);
    const res = await addToCart(mugB, 5);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  it('updates and removes lines', async () => {
    const added = await addToCart(teeA, 1);
    const itemId = added.body.data.items[0]._id;

    const updated = await request(app).patch(`${API}/cart/items/${itemId}`).set(customer.auth).send({ quantity: 4 });
    expect(updated.body.data.items[0].quantity).toBe(4);

    const removed = await request(app).delete(`${API}/cart/items/${itemId}`).set(customer.auth);
    expect(removed.body.data.items).toHaveLength(0);
  });

  it('flags products that became unavailable and leaves them out of the totals', async () => {
    await addToCart(teeA, 1);
    await addToCart(mugB, 1);
    await Product.updateOne({ _id: teeA._id }, { isActive: false });

    const res = await request(app).get(`${API}/cart`).set(customer.auth);
    const tee = res.body.data.items.find((i) => String(i.productId) === String(teeA._id));
    expect(tee.issue).toBe('unavailable');
    expect(res.body.data.summary).toMatchObject({ subtotal: 60000, hasIssues: true });
  });

  it('refuses products that are not visible', async () => {
    await Product.updateOne({ _id: teeA._id }, { status: 'pending' });
    expect((await addToCart(teeA)).status).toBe(404);
  });

  it('is for customers only', async () => {
    expect((await request(app).get(`${API}/cart`).set(sellerA.auth)).status).toBe(403);
    expect((await request(app).get(`${API}/cart`)).status).toBe(401);
  });
});

describe('Wishlist', () => {
  it('saves, lists and removes products', async () => {
    const saved = await request(app).post(`${API}/wishlist`).set(customer.auth).send({ productId: String(teeA._id) });
    expect(saved.body.data.items.map((p) => p.name)).toEqual(['Tee']);

    const removed = await request(app).delete(`${API}/wishlist/${teeA._id}`).set(customer.auth);
    expect(removed.body.data.items).toHaveLength(0);
  });

  it('hides products that are no longer visible', async () => {
    await request(app).post(`${API}/wishlist`).set(customer.auth).send({ productId: String(teeA._id) });
    await Product.updateOne({ _id: teeA._id }, { isActive: false });

    const res = await request(app).get(`${API}/wishlist`).set(customer.auth);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.productIds).toContain(String(teeA._id));
  });
});

describe('Addresses', () => {
  const body = { fullName: 'Sita Devi', phone: '9876543210', line1: '5 Park Street', city: 'Kolkata', state: 'West Bengal', postalCode: '700016' };

  it('switches the default address and promotes another when the default is deleted', async () => {
    const created = await request(app).post(`${API}/addresses`).set(customer.auth).send({ ...body, isDefault: true });
    expect(created.status).toBe(201);
    expect(created.body.data.address.isDefault).toBe(true);
    expect((await Address.findById(address._id)).isDefault).toBe(false);

    await request(app).delete(`${API}/addresses/${created.body.data.address._id}`).set(customer.auth);
    expect((await Address.findById(address._id)).isDefault).toBe(true);
  });

  it('validates PIN codes and hides other users’ addresses', async () => {
    const bad = await request(app).post(`${API}/addresses`).set(customer.auth).send({ ...body, postalCode: '12' });
    expect(bad.status).toBe(400);

    const other = await createUser('customer');
    expect((await request(app).patch(`${API}/addresses/${address._id}`).set(other.auth).send({ city: 'X City' })).status).toBe(404);
  });
});

describe('Checkout', () => {
  it('places a COD order split per seller, reserves stock and empties the cart', async () => {
    await addToCart(teeA, 2);
    await addToCart(mugB, 1);

    const res = await placeOrder();
    expect(res.status).toBe(201);

    const { order } = res.body.data;
    expect(order.orderNumber).toMatch(/^MK[0-9A-F]{12}$/);
    expect(order).toMatchObject({ status: 'confirmed', subtotal: 120000, shippingTotal: 0, total: 120000, itemCount: 3 });
    expect(order.payment).toMatchObject({ method: 'cod', status: 'pending' });
    expect(order.sellerOrders).toHaveLength(2);
    expect(order.sellerOrders.map((s) => s.orderNumber)).toEqual([`${order.orderNumber}-1`, `${order.orderNumber}-2`]);
    expect(order.shippingAddress.city).toBe('Bengaluru');

    expect(await stockOf(teeA)).toBe(3);
    expect(await stockOf(mugB)).toBe(2);
    expect((await Product.findById(teeA._id)).totalStock).toBe(3);
    expect((await Cart.findOne({ user: customer.user._id })).items).toHaveLength(0);

    const recipients = testOutbox.map((m) => m.to);
    expect(recipients).toEqual(expect.arrayContaining([customer.user.email, sellerA.user.email, sellerB.user.email]));
  });

  it('charges shipping per seller below ₹499 (after the first order)', async () => {
    await seedPastOrder();
    await addToCart(teeA, 1);
    const res = await placeOrder();
    expect(res.body.data.order).toMatchObject({ subtotal: 30000, shippingTotal: 4900, total: 34900 });
  });

  it('ships the first order free, even below ₹499', async () => {
    await addToCart(teeA, 1);
    const cart = await request(app).get(`${API}/cart`).set(customer.auth);
    expect(cart.body.data.summary).toMatchObject({ shipping: 0, firstOrderFreeDelivery: true });

    const first = await placeOrder();
    expect(first.body.data.order).toMatchObject({ subtotal: 30000, shippingTotal: 0, total: 30000 });

    await addToCart(teeA, 1);
    const second = await request(app).get(`${API}/cart`).set(customer.auth);
    expect(second.body.data.summary).toMatchObject({ shipping: 4900, firstOrderFreeDelivery: false });
  });

  it('a cancelled first order keeps the free delivery offer', async () => {
    await addToCart(teeA, 1);
    const first = (await placeOrder()).body.data.order;
    await request(app).post(`${API}/orders/${first.orderNumber}/cancel`).set(customer.auth).send({ reason: 'Changed my mind' });

    await addToCart(teeA, 1);
    const cart = await request(app).get(`${API}/cart`).set(customer.auth);
    expect(cart.body.data.summary.firstOrderFreeDelivery).toBe(true);
  });

  it('is idempotent: the same key returns the same order and takes stock once', async () => {
    await addToCart(teeA, 1);
    const idempotencyKey = crypto.randomUUID();

    const first = await placeOrder({ idempotencyKey });
    const second = await placeOrder({ idempotencyKey });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.order.orderNumber).toBe(first.body.data.order.orderNumber);
    expect(await Order.countDocuments()).toBe(1);
    expect(await stockOf(teeA)).toBe(4);
  });

  it('stops when stock dropped below the cart quantity, without changing anything', async () => {
    await addToCart(teeA, 4);
    await Product.updateOne({ _id: teeA._id, 'variants._id': teeA.variants[0]._id }, { $set: { 'variants.$.stock': 2 } });

    const res = await placeOrder();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_CHANGED');
    expect(await Order.countDocuments()).toBe(0);
    expect(await stockOf(teeA)).toBe(2);
    // The cart quantity was lowered to what is available, so the next attempt can succeed.
    expect((await Cart.findOne({ user: customer.user._id })).items[0].quantity).toBe(2);
    expect((await placeOrder()).status).toBe(201);
  });

  it('stops when a product became unavailable', async () => {
    await addToCart(teeA, 1);
    await addToCart(mugB, 1);
    await Product.updateOne({ _id: mugB._id }, { status: 'rejected' });

    const res = await placeOrder();
    expect(res.status).toBe(409);
    expect(await stockOf(teeA)).toBe(5);
  });

  it('requires a UTR for manual payment and keeps the order pending', async () => {
    await addToCart(teeA, 1);
    expect((await placeOrder({ paymentMethod: 'manual' })).status).toBe(400);

    const res = await placeOrder({ paymentMethod: 'manual', utr: 'UTR123456789' });
    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.order.payment).toMatchObject({ method: 'manual', status: 'pending_verification', utr: 'UTR123456789' });
  });

  it('rejects an empty cart and someone else’s address', async () => {
    expect((await placeOrder()).status).toBe(400);

    await addToCart(teeA, 1);
    const other = await createUser('customer');
    const otherAddress = await Address.create({ ...address.toObject(), _id: undefined, user: other.user._id });
    const res = await placeOrder({ addressId: String(otherAddress._id) });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('addressId');
  });
});

describe('Customer orders', () => {
  let order;
  beforeEach(async () => {
    await addToCart(teeA, 2);
    await addToCart(mugB, 1);
    order = (await placeOrder()).body.data.order;
  });

  it('lists and shows my orders, never someone else’s', async () => {
    const list = await request(app).get(`${API}/orders`).set(customer.auth);
    expect(list.body.data.items).toHaveLength(1);

    const detail = await request(app).get(`${API}/orders/${order.orderNumber}`).set(customer.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.order.sellerOrders[0].items[0].name).toBeDefined();

    const other = await createUser('customer');
    expect((await request(app).get(`${API}/orders/${order.orderNumber}`).set(other.auth)).status).toBe(404);
  });

  it('cancels the whole order and returns the stock', async () => {
    const res = await request(app)
      .post(`${API}/orders/${order.orderNumber}/cancel`)
      .set(customer.auth)
      .send({ reason: 'Ordered by mistake' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('cancelled');
    expect(res.body.data.order.payment.status).toBe('cancelled');
    expect(await stockOf(teeA)).toBe(5);
    expect(await stockOf(mugB)).toBe(3);
  });

  it('cancels one shipment only', async () => {
    const mugShipment = order.sellerOrders.find((s) => s.items[0].name === 'Mug');
    await request(app)
      .post(`${API}/orders/${order.orderNumber}/cancel`)
      .set(customer.auth)
      .send({ sellerOrderId: mugShipment._id, reason: 'Found it cheaper' });

    const saved = await Order.findById(order._id);
    expect(saved.status).toBe('confirmed');
    expect(await stockOf(mugB)).toBe(3);
    expect(await stockOf(teeA)).toBe(3);
  });

  it('cannot cancel after shipping', async () => {
    const shipments = await SellerOrder.find({ order: order._id });
    await SellerOrder.updateMany({ order: order._id }, { status: 'shipped' });

    const res = await request(app)
      .post(`${API}/orders/${order.orderNumber}/cancel`)
      .set(customer.auth)
      .send({ reason: 'Too late' });
    expect(res.status).toBe(409);
    expect(shipments).toHaveLength(2);
  });
});

describe('Seller and admin order management', () => {
  let order;
  let shipmentA;
  let shipmentB;
  beforeEach(async () => {
    await addToCart(teeA, 1);
    await addToCart(mugB, 1);
    order = (await placeOrder()).body.data.order;
    shipmentA = await SellerOrder.findOne({ order: order._id, seller: sellerA.user._id });
    shipmentB = await SellerOrder.findOne({ order: order._id, seller: sellerB.user._id });
  });

  const setStatus = (auth, shipment, body, base = 'seller/orders') =>
    request(app).patch(`${API}/${base}/${shipment._id}/status`).set(auth).send(body);

  it('sellers see only their own shipments', async () => {
    const list = await request(app).get(`${API}/seller/orders`).set(sellerA.auth);
    expect(list.body.data.items.map((s) => String(s._id))).toEqual([String(shipmentA._id)]);
    expect(list.body.data.counts).toMatchObject({ all: 1, confirmed: 1 });

    expect((await request(app).get(`${API}/seller/orders/${shipmentB._id}`).set(sellerA.auth)).status).toBe(404);
    expect((await setStatus(sellerA.auth, shipmentB, { status: 'processing' })).status).toBe(404);
  });

  it('moves a shipment through to delivered and marks COD as paid when everything is delivered', async () => {
    expect((await setStatus(sellerA.auth, shipmentA, { status: 'processing' })).status).toBe(200);
    const shipped = await setStatus(sellerA.auth, shipmentA, { status: 'shipped', carrier: 'Delhivery', trackingNumber: 'DL123' });
    expect(shipped.body.data.order.tracking).toMatchObject({ trackingNumber: 'DL123' });
    await setStatus(sellerA.auth, shipmentA, { status: 'delivered' });

    expect((await Order.findById(order._id)).status).toBe('confirmed'); // seller B not delivered yet

    await setStatus(sellerB.auth, shipmentB, { status: 'processing' });
    await setStatus(sellerB.auth, shipmentB, { status: 'shipped' });
    await setStatus(sellerB.auth, shipmentB, { status: 'delivered' });

    const saved = await Order.findById(order._id);
    expect(saved.status).toBe('delivered');
    expect(saved.payment.status).toBe('paid');
  });

  it('rejects skipping steps', async () => {
    const res = await setStatus(sellerA.auth, shipmentA, { status: 'delivered' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('seller cancellation needs a reason and returns stock', async () => {
    expect((await setStatus(sellerA.auth, shipmentA, { status: 'cancelled' })).status).toBe(400);
    const res = await setStatus(sellerA.auth, shipmentA, { status: 'cancelled', reason: 'Item damaged in warehouse' });
    expect(res.status).toBe(200);
    expect(await stockOf(teeA)).toBe(5);
  });

  it('a pending (manual payment) order can only be confirmed by verifying its payment', async () => {
    await addToCart(teeA, 1);
    const manual = (await placeOrder({ paymentMethod: 'manual', utr: 'UTR987654321' })).body.data.order;
    const pending = await SellerOrder.findOne({ order: manual._id });
    const admin = await createUser('admin');

    expect((await setStatus(sellerA.auth, pending, { status: 'confirmed' })).status).toBe(409);
    expect((await setStatus(admin.auth, pending, { status: 'confirmed' }, 'admin/seller-orders')).status).toBe(409);

    const payment = await Payment.findOne({ order: manual._id });
    const res = await request(app).post(`${API}/admin/payments/${payment._id}/verify`).set(admin.auth);
    expect(res.status).toBe(200);
    expect((await Order.findById(manual._id)).status).toBe('confirmed');
  });

  it('admins cannot pack or ship (that is the seller’s job)', async () => {
    const admin = await createUser('admin');
    const res = await setStatus(admin.auth, shipmentA, { status: 'processing' }, 'admin/seller-orders');
    expect(res.status).toBe(409);
  });

  it('admins list and view all orders', async () => {
    const admin = await createUser('admin');
    const list = await request(app).get(`${API}/admin/orders`).set(admin.auth);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].customer.email).toBe(customer.user.email);

    const detail = await request(app).get(`${API}/admin/orders/${order._id}`).set(admin.auth);
    expect(detail.body.data.order.sellerOrders).toHaveLength(2);

    expect((await request(app).get(`${API}/admin/orders`).set(sellerA.auth)).status).toBe(403);
  });
});

describe('deriveOrderStatus', () => {
  it('follows the least advanced active shipment', () => {
    expect(deriveOrderStatus(['delivered', 'shipped'])).toBe('shipped');
    expect(deriveOrderStatus(['delivered', 'cancelled'])).toBe('delivered');
    expect(deriveOrderStatus(['cancelled', 'cancelled'])).toBe('cancelled');
    expect(deriveOrderStatus(['pending', 'confirmed'])).toBe('pending');
  });
});
