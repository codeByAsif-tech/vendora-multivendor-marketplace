import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Product } from '../src/models/product.model.js';
import { testOutbox } from '../src/services/email.service.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import {
  createCategories,
  createProduct,
  createSeller,
  createUser,
  productImage,
  productInput,
  variantInput,
} from './helpers/factories.js';

const API = '/api/v1';
let seller;
let categories;

beforeAll(connectTestDB);
beforeEach(async () => {
  testOutbox.length = 0;
  seller = await createSeller('approved');
  categories = await createCategories();
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const input = (overrides) => productInput(seller.user._id, categories.leaf._id, overrides);
const createViaApi = (body, auth = seller.auth) => request(app).post(`${API}/seller/products`).set(auth).send(body);

describe('Seller: create product', () => {
  it('creates a simple product as pending with derived price fields', async () => {
    const res = await createViaApi(input());

    expect(res.status).toBe(201);
    const { product } = res.body.data;
    expect(product.status).toBe('pending');
    expect(product.slug).toMatch(/^classic-cotton-t-shirt-[a-f0-9]{6}$/);
    expect(product).toMatchObject({ minPrice: 79900, maxPrice: 79900, totalStock: 20, maxDiscount: 20 });
    expect(String(product.seller)).toBe(String(seller.user._id));
    expect(String(product.store)).toBe(String(seller.store._id));
  });

  it('creates a product with variants and builds the option list', async () => {
    const res = await createViaApi(input({ variants: variantInput() }));

    expect(res.status).toBe(201);
    const { product } = res.body.data;
    expect(product.variants).toHaveLength(3);
    expect(product.variantOptions).toEqual([
      { name: 'Color', values: ['Black', 'White'] },
      { name: 'Size', values: ['M', 'L'] },
    ]);
    expect(product).toMatchObject({ minPrice: 79900, maxPrice: 99900, totalStock: 13 });
  });

  it('rejects a sale price that is not lower than the price', async () => {
    const res = await createViaApi(input({ variants: [{ sku: 'A1', price: 50000, salePrice: 50000, stock: 1 }] }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('variants.0.salePrice');
  });

  it('rejects decimal (non-paise) prices', async () => {
    const res = await createViaApi(input({ variants: [{ sku: 'A1', price: 499.5, stock: 1 }] }));
    expect(res.status).toBe(400);
  });

  it('rejects duplicate SKUs and inconsistent variant attributes', async () => {
    const variants = variantInput();
    variants[1].sku = variants[0].sku;
    variants[2].attributes = [{ name: 'Material', value: 'Cotton' }];

    const res = await createViaApi(input({ variants }));
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['variants.1.sku', 'variants.2.attributes']));
  });

  it('rejects an SKU already used by another of the seller’s products', async () => {
    await createViaApi(input());
    const res = await createViaApi(input({ name: 'Another Tee' }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SKU_TAKEN');
  });

  it('allows the same SKU for different sellers', async () => {
    const other = await createSeller('approved');
    await createViaApi(input());
    const res = await createViaApi(
      productInput(other.user._id, categories.leaf._id),
      other.auth,
    );
    expect(res.status).toBe(201);
  });

  it('only accepts active leaf categories', async () => {
    const parentRes = await createViaApi(input({ category: String(categories.parent._id) }));
    expect(parentRes.status).toBe(400);
    expect(parentRes.body.errors[0].message).toMatch(/subcategory/i);

    const inactiveRes = await createViaApi(input({ category: String(categories.inactive._id) }));
    expect(inactiveRes.status).toBe(400);
  });

  it('rejects images that were not uploaded into the seller’s own folder', async () => {
    const other = await createSeller('approved');
    const foreign = await createViaApi(input({ images: [productImage(other.user._id)] }));
    expect(foreign.status).toBe(400);

    const external = await createViaApi(
      input({ images: [{ url: 'https://evil.example/x.png', publicId: `marketplace/products/${seller.user._id}/x` }] }),
    );
    expect(external.status).toBe(400);
  });

  it('ignores client attempts to set status or seller', async () => {
    const res = await createViaApi({ ...input(), status: 'approved' });
    expect(res.status).toBe(400); // strict schema
  });
});

describe('Seller: product ownership', () => {
  it('lists only the seller’s own products with status counts', async () => {
    const other = await createSeller('approved');
    await createProduct(seller, categories.leaf._id);
    await createProduct(seller, categories.leaf._id, { status: 'approved' });
    await createProduct(other, categories.leaf._id);

    const res = await request(app).get(`${API}/seller/products`).set(seller.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.counts).toMatchObject({ all: 2, pending: 1, approved: 1 });
  });

  it('returns 404 when reading, updating or deleting another seller’s product', async () => {
    const other = await createSeller('approved');
    const product = await createProduct(other, categories.leaf._id);
    const url = `${API}/seller/products/${product._id}`;

    expect((await request(app).get(url).set(seller.auth)).status).toBe(404);
    expect((await request(app).patch(url).set(seller.auth).send({ name: 'Stolen name' })).status).toBe(404);
    expect((await request(app).delete(url).set(seller.auth)).status).toBe(404);
    expect((await Product.findById(product._id)).name).not.toBe('Stolen name');
  });
});

describe('Seller: update product', () => {
  it('sends an approved product back to review when content changes', async () => {
    const product = await createProduct(seller, categories.leaf._id, { status: 'approved' });
    const res = await request(app)
      .patch(`${API}/seller/products/${product._id}`)
      .set(seller.auth)
      .send({ name: 'Renamed T-Shirt' });

    expect(res.status).toBe(200);
    expect(res.body.data.product.status).toBe('pending');
  });

  it('keeps an approved product approved when only price or stock changes', async () => {
    const product = await createProduct(seller, categories.leaf._id, { status: 'approved' });
    const variant = product.variants[0];

    const res = await request(app)
      .patch(`${API}/seller/products/${product._id}`)
      .set(seller.auth)
      .send({ variants: [{ _id: String(variant._id), sku: variant.sku, price: 45000, stock: 99 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.product.status).toBe('approved');
    expect(res.body.data.product.minPrice).toBe(45000);
    // Variant id is preserved so carts/orders keep working.
    expect(res.body.data.product.variants[0]._id).toBe(String(variant._id));
  });

  it('resubmits a rejected product on any change and clears the reason', async () => {
    const product = await createProduct(seller, categories.leaf._id, {
      status: 'rejected',
      rejectionReason: 'Blurry images',
    });
    const res = await request(app)
      .patch(`${API}/seller/products/${product._id}`)
      .set(seller.auth)
      .send({ isActive: true });

    expect(res.body.data.product.status).toBe('pending');
    expect(res.body.data.product.rejectionReason).toBeUndefined();
  });

  it('toggles visibility', async () => {
    const product = await createProduct(seller, categories.leaf._id);
    const res = await request(app)
      .patch(`${API}/seller/products/${product._id}/visibility`)
      .set(seller.auth)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.product.isActive).toBe(false);
  });

  it('soft-deletes a product', async () => {
    const product = await createProduct(seller, categories.leaf._id);
    const res = await request(app).delete(`${API}/seller/products/${product._id}`).set(seller.auth);

    expect(res.status).toBe(200);
    const saved = await Product.findById(product._id);
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect((await request(app).get(`${API}/seller/products/${product._id}`).set(seller.auth)).status).toBe(404);
  });
});

describe('Seller: inventory', () => {
  let product;

  beforeEach(async () => {
    const res = await createViaApi(input({ variants: variantInput() }));
    product = res.body.data.product;
  });

  it('lists SKUs lowest stock first and filters low / out of stock', async () => {
    const all = await request(app).get(`${API}/seller/inventory`).set(seller.auth);
    expect(all.status).toBe(200);
    expect(all.body.data.items.map((i) => i.stock)).toEqual([0, 3, 10]);

    const low = await request(app).get(`${API}/seller/inventory?stock=low`).set(seller.auth);
    expect(low.body.data.items.map((i) => i.sku)).toEqual(['TS-BLK-L']);

    const out = await request(app).get(`${API}/seller/inventory?stock=out`).set(seller.auth);
    expect(out.body.data.items.map((i) => i.sku)).toEqual(['TS-WHT-M']);
  });

  it('returns stats', async () => {
    const res = await request(app).get(`${API}/seller/inventory/stats`).set(seller.auth);
    expect(res.body.data).toMatchObject({ products: 1, skus: 3, units: 13, outOfStock: 1, lowStock: 1 });
    // 10 × 79900 + 3 × 99900 + 0
    expect(res.body.data.stockValue).toBe(10 * 79900 + 3 * 99900);
  });

  it('updates the stock of one SKU and recomputes totalStock', async () => {
    const variant = product.variants.find((v) => v.sku === 'TS-WHT-M');
    const res = await request(app)
      .patch(`${API}/seller/inventory/${product._id}/variants/${variant._id}`)
      .set(seller.auth)
      .send({ stock: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stock: 7, totalStock: 20 });
  });

  it('rejects negative stock and unknown variants', async () => {
    const variant = product.variants[0];
    const negative = await request(app)
      .patch(`${API}/seller/inventory/${product._id}/variants/${variant._id}`)
      .set(seller.auth)
      .send({ stock: -1 });
    expect(negative.status).toBe(400);

    const unknown = await request(app)
      .patch(`${API}/seller/inventory/${product._id}/variants/665f1c2e8b3a4c0012ab34cd`)
      .set(seller.auth)
      .send({ stock: 1 });
    expect(unknown.status).toBe(404);
  });
});

describe('Admin: product moderation', () => {
  let admin;
  beforeEach(async () => {
    admin = await createUser('admin');
  });

  it('lists products with status counts', async () => {
    await createProduct(seller, categories.leaf._id);
    await createProduct(seller, categories.leaf._id, { status: 'approved' });

    const res = await request(app).get(`${API}/admin/products?status=pending`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].store.storeName).toBe(seller.store.storeName);
    expect(res.body.data.counts).toMatchObject({ all: 2, pending: 1, approved: 1 });
  });

  it('approves a product and emails the seller', async () => {
    const product = await createProduct(seller, categories.leaf._id);
    const res = await request(app)
      .patch(`${API}/admin/products/${product._id}/moderation`)
      .set(admin.auth)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.product.status).toBe('approved');
    expect(testOutbox.at(-1)).toMatchObject({ to: seller.user.email });
  });

  it('requires a reason to reject', async () => {
    const product = await createProduct(seller, categories.leaf._id);
    const url = `${API}/admin/products/${product._id}/moderation`;

    expect((await request(app).patch(url).set(admin.auth).send({ status: 'rejected' })).status).toBe(400);

    const res = await request(app).patch(url).set(admin.auth).send({ status: 'rejected', reason: 'Images are blurry' });
    expect(res.body.data.product).toMatchObject({ status: 'rejected', rejectionReason: 'Images are blurry' });
  });

  it('is admin only', async () => {
    const product = await createProduct(seller, categories.leaf._id);
    const res = await request(app)
      .patch(`${API}/admin/products/${product._id}/moderation`)
      .set(seller.auth)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });
});
