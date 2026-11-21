import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Category } from '../src/models/category.model.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller } from './helpers/factories.js';

const API = '/api/v1';
let seller;
let categories;

beforeAll(connectTestDB);
beforeEach(async () => {
  seller = await createSeller('approved');
  categories = await createCategories();
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const approved = (overrides = {}) =>
  createProduct(seller, categories.leaf._id, { status: 'approved', ...overrides });

const variant = (sku, price, stock = 10, extra = {}) => ({ sku, price, stock, ...extra });

describe('Visibility rules', () => {
  it('lists only approved, active products of approved stores in active categories', async () => {
    await approved({ name: 'Visible Tee' });
    await createProduct(seller, categories.leaf._id, { name: 'Pending Tee' });
    await approved({ name: 'Rejected Tee', status: 'rejected' });
    await approved({ name: 'Hidden Tee', isActive: false });
    await approved({ name: 'Deleted Tee', deletedAt: new Date() });
    await createProduct(seller, categories.inactive._id, { name: 'Inactive Category Tee', status: 'approved' });

    const suspended = await createSeller('suspended');
    await createProduct(suspended, categories.leaf._id, { name: 'Suspended Store Tee', status: 'approved' });

    const res = await request(app).get(`${API}/products`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Visible Tee']);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it('hides products of an inactive parent category', async () => {
    await approved({ name: 'Visible Tee' });
    await Category.updateOne({ _id: categories.parent._id }, { isActive: false });

    const res = await request(app).get(`${API}/products`);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns 404 for a product that is not visible', async () => {
    const hidden = await approved({ isActive: false });
    const res = await request(app).get(`${API}/products/${hidden.slug}`);
    expect(res.status).toBe(404);
  });
});

describe('Product page', () => {
  it('returns the product without private fields and only active variants', async () => {
    const product = await approved({
      variants: [variant('A-1', 50000), variant('A-2', 60000, 5, { isActive: false })],
    });
    await approved({ name: 'Related Tee' });

    const res = await request(app).get(`${API}/products/${product.slug}`);
    expect(res.status).toBe(200);

    const { product: body, related } = res.body.data;
    expect(body.variants).toHaveLength(1);
    expect(body.seller).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.rejectionReason).toBeUndefined();
    expect(body.store.storeName).toBe(seller.store.storeName);
    expect(body.store.bank).toBeUndefined();
    expect(body.store.pan).toBeUndefined();
    expect(body.category.parent.slug).toBe('fashion');
    expect(related.map((p) => p.name)).toEqual(['Related Tee']);
  });
});

describe('Filters, sorting and search', () => {
  beforeEach(async () => {
    await approved({ name: 'Budget Tee', brand: 'Alpha', variants: [variant('B-1', 50000)] });
    await approved({ name: 'Mid Tee', brand: 'Beta', variants: [variant('M-1', 150000)] });
    await approved({ name: 'Premium Tee', brand: 'Alpha', variants: [variant('P-1', 300000, 0)] });
  });

  it('filters by price range (paise)', async () => {
    const res = await request(app).get(`${API}/products?minPrice=100000&maxPrice=200000`);
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Mid Tee']);
  });

  it('filters by brand and stock', async () => {
    const alpha = await request(app).get(`${API}/products?brand=Alpha&sort=price_asc`);
    expect(alpha.body.data.items.map((p) => p.name)).toEqual(['Budget Tee', 'Premium Tee']);

    const inStock = await request(app).get(`${API}/products?brand=Alpha&inStock=true`);
    expect(inStock.body.data.items.map((p) => p.name)).toEqual(['Budget Tee']);
  });

  it('sorts by price', async () => {
    const res = await request(app).get(`${API}/products?sort=price_desc`);
    expect(res.body.data.items.map((p) => p.minPrice)).toEqual([300000, 150000, 50000]);
  });

  it('returns brand and price facets for the result set', async () => {
    const res = await request(app).get(`${API}/products?brand=Beta`);
    // Facets ignore the brand filter itself, so the user can switch brands.
    expect(res.body.data.facets).toEqual({ brands: ['Alpha', 'Beta'], priceRange: { min: 50000, max: 300000 } });
  });

  it('paginates', async () => {
    const res = await request(app).get(`${API}/products?limit=2&page=2&sort=price_asc`);
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Premium Tee']);
    expect(res.body.data.pagination).toMatchObject({ page: 2, total: 3, totalPages: 2 });
  });

  it('searches by text', async () => {
    await approved({ name: 'Wireless Headphones', brand: 'Sonic' });
    const res = await request(app).get(`${API}/products?search=headphones&sort=relevance`);
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Wireless Headphones']);
  });

  it('rejects bad query values', async () => {
    expect((await request(app).get(`${API}/products?sort=hack`)).status).toBe(400);
    expect((await request(app).get(`${API}/products?limit=500`)).status).toBe(400);
  });
});

describe('Categories and stores', () => {
  it('a parent category includes products of its subcategories', async () => {
    await approved({ name: 'Fashion Tee' });
    const electronics = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const phones = await Category.create({ name: 'Phones', slug: 'electronics-phones', parent: electronics._id, level: 1 });
    await createProduct(seller, phones._id, { name: 'Phone', status: 'approved' });

    const fashion = await request(app).get(`${API}/products?category=fashion`);
    expect(fashion.body.data.items.map((p) => p.name)).toEqual(['Fashion Tee']);

    const phonesRes = await request(app).get(`${API}/products?category=electronics-phones`);
    expect(phonesRes.body.data.items.map((p) => p.name)).toEqual(['Phone']);

    expect((await request(app).get(`${API}/products?category=nope`)).status).toBe(404);
  });

  it('returns a category with its active subcategories', async () => {
    const res = await request(app).get(`${API}/categories/fashion`);
    expect(res.status).toBe(200);
    expect(res.body.data.category.children.map((c) => c.slug)).toEqual(['fashion-t-shirts']);

    expect((await request(app).get(`${API}/categories/fashion-hidden`)).status).toBe(404);
  });

  it('returns a public store profile and filters products by store', async () => {
    await approved({ name: 'Our Tee' });
    const other = await createSeller('approved');
    await createProduct(other, categories.leaf._id, { name: 'Their Tee', status: 'approved' });

    const store = await request(app).get(`${API}/stores/${seller.store.slug}`);
    expect(store.status).toBe(200);
    expect(store.body.data.store).toMatchObject({ storeName: seller.store.storeName, productCount: 1 });
    expect(store.body.data.store.bank).toBeUndefined();
    expect(store.body.data.store.contactEmail).toBeUndefined();

    const products = await request(app).get(`${API}/products?store=${seller.store.slug}`);
    expect(products.body.data.items.map((p) => p.name)).toEqual(['Our Tee']);
  });

  it('hides stores that are not approved', async () => {
    const pending = await createSeller('pending');
    expect((await request(app).get(`${API}/stores/${pending.store.slug}`)).status).toBe(404);
  });
});
