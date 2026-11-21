import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Address } from '../src/models/address.model.js';
import { Order, SellerOrder } from '../src/models/order.model.js';
import { Payment } from '../src/models/payment.model.js';
import { Transaction } from '../src/models/transaction.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let customer;
let admin;
let sellerA;
let sellerB;
let teeA; // ₹600 (free shipping)
let mugB; // ₹700 (free shipping)
let address;

beforeAll(connectTestDB);
beforeEach(async () => {
  testOutbox.length = 0;
  const { leaf } = await createCategories();
  customer = await createUser('customer');
  admin = await createUser('admin');
  sellerA = await createSeller('approved');
  sellerB = await createSeller('approved');
  teeA = await createProduct(sellerA, leaf._id, { status: 'approved', name: 'Tee', variants: [{ sku: 'TEE-1', price: 60000, stock: 10 }] });
  mugB = await createProduct(sellerB, leaf._id, { status: 'approved', name: 'Mug', variants: [{ sku: 'MUG-1', price: 70000, stock: 10 }] });
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

async function order(paymentMethod = 'manual', utr = `UTR${crypto.randomInt(1e9, 9e9)}`, products = [teeA, mugB]) {
  for (const product of products) {
    await request(app)
      .post(`${API}/cart/items`)
      .set(customer.auth)
      .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 1 });
  }
  const res = await request(app)
    .post(`${API}/orders`)
    .set(customer.auth)
    .send({
      addressId: String(address._id),
      paymentMethod,
      ...(paymentMethod === 'manual' ? { utr } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
  const placed = res.body.data?.order;
  const payment = placed ? await Payment.findOne({ order: placed._id }) : null;
  return { res, order: placed, payment };
}

const verify = (payment) => request(app).post(`${API}/admin/payments/${payment._id}/verify`).set(admin.auth);
const reject = (payment, reason = 'No such UTR in our statement') =>
  request(app).post(`${API}/admin/payments/${payment._id}/reject`).set(admin.auth).send({ reason });
const shipmentOf = (placed, seller) => SellerOrder.findOne({ order: placed._id, seller: seller.user._id });
const setStatus = (auth, shipment, body) => request(app).patch(`${API}/seller/orders/${shipment._id}/status`).set(auth).send(body);

describe('Payment records', () => {
  it('creates a payment with every order (UTR stored upper-case)', async () => {
    const { payment: manual } = await order('manual', 'utr123abc456');
    expect(manual).toMatchObject({ method: 'manual', status: 'pending_verification', amount: 130000, utr: 'UTR123ABC456' });

    const { payment: cod } = await order('cod');
    expect(cod).toMatchObject({ method: 'cod', status: 'pending', amountPaid: 0 });
  });

  it('refuses a UTR that was already used', async () => {
    await order('manual', 'UTR111222333');
    const { res } = await order('manual', 'utr111222333');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('UTR_USED');
  });
});

describe('Verification', () => {
  it('verifies: payment paid, transaction recorded, shipments confirmed, customer emailed', async () => {
    const { order: placed, payment } = await order();
    const res = await verify(payment);

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toMatchObject({ status: 'paid', amountPaid: 130000 });

    const saved = await Order.findById(placed._id);
    expect(saved.status).toBe('confirmed');
    expect(saved.payment.status).toBe('paid');
    expect((await SellerOrder.find({ order: placed._id })).every((s) => s.status === 'confirmed')).toBe(true);

    const txns = await Transaction.find({ payment: payment._id });
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ type: 'payment_received', direction: 'in', amount: 130000, reference: payment.utr });

    expect(testOutbox.at(-1)).toMatchObject({ to: customer.user.email });
    expect(testOutbox.at(-1).subject).toMatch(/payment received/i);
  });

  it('cannot verify twice', async () => {
    const { payment } = await order();
    await verify(payment);
    const again = await verify(payment);
    expect(again.status).toBe(409);
    expect(await Transaction.countDocuments()).toBe(1);
  });

  it('is admin only', async () => {
    const { payment } = await order();
    expect((await request(app).post(`${API}/admin/payments/${payment._id}/verify`).set(sellerA.auth)).status).toBe(403);
    expect((await request(app).get(`${API}/admin/payments`).set(customer.auth)).status).toBe(403);
  });
});

describe('Rejection and resubmission', () => {
  it('rejects a UTR, lets the customer submit a new one, and blocks the rejected UTR forever', async () => {
    const { order: placed, payment } = await order('manual', 'FAKEUTR0001');

    const rejected = await reject(payment);
    expect(rejected.body.data.payment).toMatchObject({ status: 'rejected', rejectionReason: 'No such UTR in our statement' });
    expect((await SellerOrder.findOne({ order: placed._id })).status).toBe('pending');
    expect((await Order.findById(placed._id)).payment.status).toBe('rejected');

    const resubmitUrl = `${API}/orders/${placed.orderNumber}/payment`;
    const sameAgain = await request(app).post(resubmitUrl).set(customer.auth).send({ utr: 'FAKEUTR0001' });
    expect(sameAgain.status).toBe(409);

    const fresh = await request(app).post(resubmitUrl).set(customer.auth).send({ utr: 'REALUTR0002' });
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.payment).toMatchObject({ status: 'pending_verification', utr: 'REALUTR0002' });

    expect((await verify(await Payment.findById(payment._id))).status).toBe(200);
  });

  it('only the order’s customer can resubmit, and only after a rejection', async () => {
    const { order: placed } = await order();
    const url = `${API}/orders/${placed.orderNumber}/payment`;

    expect((await request(app).post(url).set(customer.auth).send({ utr: 'NEWUTR0003' })).status).toBe(409);

    const other = await createUser('customer');
    expect((await request(app).post(url).set(other.auth).send({ utr: 'NEWUTR0004' })).status).toBe(404);
  });
});

describe('Cash on Delivery', () => {
  it('records cash per delivered shipment and marks the payment paid when all are delivered', async () => {
    const { order: placed, payment } = await order('cod');
    const tee = await shipmentOf(placed, sellerA);
    const mug = await shipmentOf(placed, sellerB);

    for (const step of ['processing', 'shipped', 'delivered']) await setStatus(sellerA.auth, tee, { status: step });
    let saved = await Payment.findById(payment._id);
    expect(saved).toMatchObject({ status: 'pending', amountPaid: 60000 });

    for (const step of ['processing', 'shipped', 'delivered']) await setStatus(sellerB.auth, mug, { status: step });
    saved = await Payment.findById(payment._id);
    expect(saved).toMatchObject({ status: 'paid', amountPaid: 130000 });

    const txns = await Transaction.find({ type: 'cod_collected' }).sort({ createdAt: 1 });
    expect(txns.map((t) => t.amount)).toEqual([60000, 70000]);
    expect(String(txns[0].store)).toBe(String(sellerA.store._id));
  });

  it('completes when the rest of the order was cancelled', async () => {
    const { order: placed, payment } = await order('cod');
    const tee = await shipmentOf(placed, sellerA);
    const mug = await shipmentOf(placed, sellerB);

    await setStatus(sellerB.auth, mug, { status: 'cancelled', reason: 'Out of stock in warehouse' });
    for (const step of ['processing', 'shipped', 'delivered']) await setStatus(sellerA.auth, tee, { status: step });

    expect(await Payment.findById(payment._id)).toMatchObject({ status: 'paid', amountPaid: 60000 });
  });
});

describe('Refunds', () => {
  it('a cancelled shipment of a paid order becomes refund due; admin records the refund', async () => {
    const { order: placed, payment } = await order();
    await verify(payment);
    const mug = await shipmentOf(placed, sellerB);
    await setStatus(sellerB.auth, mug, { status: 'cancelled', reason: 'Damaged before packing' });

    let saved = await Payment.findById(payment._id);
    expect(saved).toMatchObject({ status: 'paid', refundDue: 70000, refundedAmount: 0 });

    const list = await request(app).get(`${API}/admin/payments?status=refund_due`).set(admin.auth);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.counts.refund_due).toBe(1);

    const tooMuch = await request(app)
      .post(`${API}/admin/payments/${payment._id}/refunds`)
      .set(admin.auth)
      .send({ amount: 80000, reference: 'REF1' });
    expect(tooMuch.status).toBe(400);

    const ok = await request(app)
      .post(`${API}/admin/payments/${payment._id}/refunds`)
      .set(admin.auth)
      .send({ amount: 70000, reference: 'UPI-REF-1' });
    expect(ok.status).toBe(200);

    saved = await Payment.findById(payment._id);
    expect(saved.refundedAmount).toBe(70000);
    expect((await Order.findById(placed._id)).payment.refundedAmount).toBe(70000);

    const again = await request(app)
      .post(`${API}/admin/payments/${payment._id}/refunds`)
      .set(admin.auth)
      .send({ amount: 100, reference: 'REF2' });
    expect(again.status).toBe(409);
  });

  it('cancelling before verification keeps the payment open; verifying then makes it refund due', async () => {
    const { order: placed, payment } = await order();
    await request(app).post(`${API}/orders/${placed.orderNumber}/cancel`).set(customer.auth).send({ reason: 'Changed my mind' });

    expect((await Payment.findById(payment._id)).status).toBe('pending_verification');

    await verify(payment);
    expect(await Payment.findById(payment._id)).toMatchObject({ status: 'paid', refundDue: 130000 });
  });

  it('a COD order cancelled before delivery is simply cancelled', async () => {
    const { order: placed, payment } = await order('cod');
    await request(app).post(`${API}/orders/${placed.orderNumber}/cancel`).set(customer.auth).send({ reason: 'Changed my mind' });
    expect((await Payment.findById(payment._id)).status).toBe('cancelled');
  });
});

describe('Transactions ledger', () => {
  it('lists transactions with totals', async () => {
    const online = await order();
    await verify(online.payment);
    const cod = await order('cod', undefined, [teeA]);
    const tee = await shipmentOf(cod.order, sellerA);
    for (const step of ['processing', 'shipped', 'delivered']) await setStatus(sellerA.auth, tee, { status: step });

    const res = await request(app).get(`${API}/admin/transactions`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.summary).toMatchObject({ received: 130000, codCollected: 60000, refunded: 0, net: 190000 });

    const onlyCod = await request(app).get(`${API}/admin/transactions?type=cod_collected`).set(admin.auth);
    expect(onlyCod.body.data.items).toHaveLength(1);
    expect(onlyCod.body.data.summary.net).toBe(190000); // totals ignore the type tab

    const overview = await request(app).get(`${API}/admin/overview`).set(admin.auth);
    expect(overview.body.data.collected).toBe(190000);
  });
});
