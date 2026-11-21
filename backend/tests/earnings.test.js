import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Address } from '../src/models/address.model.js';
import { LedgerEntry, Payout, SellerWallet } from '../src/models/earnings.model.js';
import { SellerOrder } from '../src/models/order.model.js';
import { SellerProfile } from '../src/models/sellerProfile.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';

let customer;
let admin;
let sellerA;
let sellerB;
let teeA; // ₹600 → free shipping
let mugB; // ₹700 → free shipping
let address;

beforeAll(connectTestDB);
beforeEach(async () => {
  testOutbox.length = 0;
  const { leaf } = await createCategories();
  customer = await createUser('customer');
  admin = await createUser('admin');
  sellerA = await createSeller('approved');
  sellerB = await createSeller('approved');
  teeA = await createProduct(sellerA, leaf._id, { status: 'approved', name: 'Tee', variants: [{ sku: 'TEE-1', price: 60000, stock: 20 }] });
  mugB = await createProduct(sellerB, leaf._id, { status: 'approved', name: 'Mug', variants: [{ sku: 'MUG-1', price: 70000, stock: 20 }] });
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

/** Places a COD order (shipments start "confirmed"). */
async function placeCodOrder(products = [teeA, mugB]) {
  for (const product of products) {
    await request(app)
      .post(`${API}/cart/items`)
      .set(customer.auth)
      .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 1 });
  }
  const res = await request(app)
    .post(`${API}/orders`)
    .set(customer.auth)
    .send({ addressId: String(address._id), paymentMethod: 'cod', idempotencyKey: crypto.randomUUID() });
  expect(res.status).toBe(201);
  return res.body.data.order;
}

const shipmentOf = (placed, seller) => SellerOrder.findOne({ order: placed._id, seller: seller.user._id });

async function deliver(seller, shipment) {
  for (const status of ['processing', 'shipped', 'delivered']) {
    const res = await request(app).patch(`${API}/seller/orders/${shipment._id}/status`).set(seller.auth).send({ status });
    expect(res.status).toBe(200);
  }
}

/** Pretends the hold window is over for every earning. */
const endHold = () => LedgerEntry.updateMany({ status: 'on_hold' }, { $set: { availableAt: new Date(Date.now() - 1000) } });

const wallet = (seller) => request(app).get(`${API}/seller/earnings`).set(seller.auth);
const payout = (body) => request(app).post(`${API}/admin/payouts`).set(admin.auth).send(body);

describe('Commission at checkout', () => {
  it('snapshots the platform default rate (10%) on each shipment and hides it from the customer', async () => {
    const placed = await placeCodOrder();
    const tee = await shipmentOf(placed, sellerA);
    // ₹600 items, free shipping → commission ₹60, seller gets ₹540
    expect(tee).toMatchObject({ commissionRate: 10, commissionAmount: 6000, sellerEarning: 54000 });

    const customerView = await request(app).get(`${API}/orders/${placed.orderNumber}`).set(customer.auth);
    const shipment = customerView.body.data.order.sellerOrders[0];
    expect(shipment.commissionRate).toBeUndefined();
    expect(shipment.commissionAmount).toBeUndefined();
    expect(shipment.sellerEarning).toBeUndefined();
  });

  it('uses a store override, and later rate changes do not touch placed orders', async () => {
    await request(app).patch(`${API}/admin/sellers/${sellerA.store._id}/commission`).set(admin.auth).send({ rate: 5 }).expect(200);
    const placed = await placeCodOrder();

    const res = await request(app).put(`${API}/admin/settings/commission`).set(admin.auth).send({ defaultRate: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.defaultRate).toBe(20);

    expect(await shipmentOf(placed, sellerA)).toMatchObject({ commissionRate: 5, commissionAmount: 3000 });
    expect(await shipmentOf(placed, sellerB)).toMatchObject({ commissionRate: 10, commissionAmount: 7000 });

    // Clearing the override puts the store back on the (new) default
    await request(app).patch(`${API}/admin/sellers/${sellerA.store._id}/commission`).set(admin.auth).send({ rate: null }).expect(200);
    expect((await SellerProfile.findById(sellerA.store._id)).commissionRate).toBeNull();
    expect((await wallet(sellerA)).body.data.wallet.commissionRate).toBe(20);
  });

  it('validates rates and is admin only', async () => {
    const put = (auth, body) => request(app).put(`${API}/admin/settings/commission`).set(auth).send(body);
    expect((await put(admin.auth, { defaultRate: 60 })).status).toBe(400);
    expect((await put(admin.auth, { defaultRate: 7.125 })).status).toBe(400);
    expect((await put(admin.auth, { defaultRate: 7.5 })).status).toBe(200);
    expect((await put(sellerA.auth, { defaultRate: 0 })).status).toBe(403);
  });
});

describe('Earnings ledger', () => {
  it('credits the seller on delivery, on hold first, then available after the hold', async () => {
    const placed = await placeCodOrder();
    const tee = await shipmentOf(placed, sellerA);

    let res = await wallet(sellerA);
    expect(res.body.data.wallet).toMatchObject({ onHold: 0, available: 0, totalEarned: 0 });

    await deliver(sellerA, tee);
    res = await wallet(sellerA);
    expect(res.body.data.wallet).toMatchObject({ onHold: 54000, available: 0, totalEarned: 54000, totalCommission: 6000, holdDays: 7 });
    expect(res.body.data.wallet.nextRelease.amount).toBe(54000);

    // Seller B has not delivered: nothing earned
    expect((await wallet(sellerB)).body.data.wallet.totalEarned).toBe(0);

    await endHold();
    res = await wallet(sellerA);
    expect(res.body.data.wallet).toMatchObject({ onHold: 0, available: 54000 });

    const ledger = await request(app).get(`${API}/seller/earnings/ledger`).set(sellerA.auth);
    expect(ledger.body.data.items).toHaveLength(1);
    expect(ledger.body.data.items[0]).toMatchObject({ type: 'earning', amount: 54000, gross: 60000, commission: 6000, status: 'available' });
  });

  it('never credits the same shipment twice', async () => {
    const placed = await placeCodOrder([teeA]);
    const tee = await shipmentOf(placed, sellerA);
    await deliver(sellerA, tee);

    const again = await request(app).patch(`${API}/seller/orders/${tee._id}/status`).set(sellerA.auth).send({ status: 'delivered' });
    expect(again.status).toBe(409);
    expect(await LedgerEntry.countDocuments({ type: 'earning' })).toBe(1);
  });

  it('does not credit cancelled shipments', async () => {
    const placed = await placeCodOrder([teeA]);
    const tee = await shipmentOf(placed, sellerA);
    await request(app)
      .patch(`${API}/seller/orders/${tee._id}/status`)
      .set(sellerA.auth)
      .send({ status: 'cancelled', reason: 'Out of stock' })
      .expect(200);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });
});

describe('Payouts', () => {
  async function sellerWithAvailableBalance() {
    const placed = await placeCodOrder([teeA]);
    await deliver(sellerA, await shipmentOf(placed, sellerA));
    await endHold();
  }

  it('records a payout: wallet debited, ledger entry, seller emailed', async () => {
    await sellerWithAvailableBalance();

    const res = await payout({ storeId: String(sellerA.store._id), amount: 50000, method: 'bank_transfer', reference: 'neft-123456' });
    expect(res.status).toBe(201);
    expect(res.body.data.payout).toMatchObject({ amount: 50000, reference: 'NEFT-123456', bank: { accountNumberLast4: '6789' } });

    const saved = await SellerWallet.findOne({ store: sellerA.store._id });
    expect(saved).toMatchObject({ available: 4000, totalPaidOut: 50000 });
    expect(await LedgerEntry.findOne({ type: 'payout' })).toMatchObject({ amount: -50000 });
    expect(testOutbox.at(-1)).toMatchObject({ to: sellerA.user.email });
    expect(testOutbox.at(-1).subject).toMatch(/payout/i);

    const mine = await request(app).get(`${API}/seller/payouts`).set(sellerA.auth);
    expect(mine.body.data.items).toHaveLength(1);
  });

  it('cannot pay out more than the available balance (money on hold included)', async () => {
    const placed = await placeCodOrder([teeA]);
    await deliver(sellerA, await shipmentOf(placed, sellerA));

    const onHold = await payout({ storeId: String(sellerA.store._id), amount: 1000, method: 'upi', reference: 'UPI00001' });
    expect(onHold.status).toBe(409);
    expect(onHold.body.code).toBe('INSUFFICIENT_BALANCE');

    await endHold();
    const tooMuch = await payout({ storeId: String(sellerA.store._id), amount: 54001, method: 'upi', reference: 'UPI00002' });
    expect(tooMuch.status).toBe(409);
    expect(await Payout.countDocuments()).toBe(0);
  });

  it('refuses a reference that was already recorded', async () => {
    await sellerWithAvailableBalance();
    await payout({ storeId: String(sellerA.store._id), amount: 1000, method: 'upi', reference: 'REF0001' }).expect(201);
    const dup = await payout({ storeId: String(sellerA.store._id), amount: 1000, method: 'upi', reference: 'ref0001' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DUPLICATE_REFERENCE');
    expect((await SellerWallet.findOne({ store: sellerA.store._id })).available).toBe(53000);
  });

  it('two payouts at the same time cannot overdraw the wallet', async () => {
    await sellerWithAvailableBalance();
    const body = (reference) => ({ storeId: String(sellerA.store._id), amount: 54000, method: 'bank_transfer', reference });
    const results = await Promise.all([payout(body('PAR0001')), payout(body('PAR0002'))]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await SellerWallet.findOne({ store: sellerA.store._id })).available).toBe(0);
  });

  it('lists balances for admins and shows totals on the overview', async () => {
    await sellerWithAvailableBalance();

    const res = await request(app).get(`${API}/admin/payouts/balances?due=true`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ available: 54000, commissionRate: 10 });
    expect(res.body.data.totals).toMatchObject({ available: 54000, totalCommission: 6000, sellersDue: 1 });

    const overview = await request(app).get(`${API}/admin/overview`).set(admin.auth);
    expect(overview.body.data).toMatchObject({ commissionEarned: 6000, payoutsDue: 54000 });
  });

  it('is admin only', async () => {
    expect((await request(app).get(`${API}/admin/payouts`).set(sellerA.auth)).status).toBe(403);
    const res = await request(app)
      .post(`${API}/admin/payouts`)
      .set(sellerA.auth)
      .send({ storeId: String(sellerA.store._id), amount: 100, method: 'upi', reference: 'SELF0001' });
    expect(res.status).toBe(403);
  });
});
