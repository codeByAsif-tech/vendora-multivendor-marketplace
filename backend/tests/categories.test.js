import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Category } from '../src/models/category.model.js';
import { clearTestDB, connectTestDB, disconnectTestDB } from './helpers/db.js';
import { createCategories, createProduct, createSeller, createUser } from './helpers/factories.js';

const API = '/api/v1';
let admin;

beforeAll(connectTestDB);
beforeEach(async () => {
  admin = await createUser('admin');
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const create = (body) => request(app).post(`${API}/admin/categories`).set(admin.auth).send(body);

describe('Admin: categories', () => {
  it('creates a category and a subcategory with prefixed slug', async () => {
    const parent = await create({ name: "Men's Fashion" });
    expect(parent.status).toBe(201);
    expect(parent.body.data.category).toMatchObject({ slug: 'mens-fashion', level: 0, parent: null });

    const child = await create({ name: 'T-Shirts', parent: parent.body.data.category._id });
    expect(child.status).toBe(201);
    expect(child.body.data.category).toMatchObject({ slug: 'mens-fashion-t-shirts', level: 1 });
  });

  it('allows only two levels', async () => {
    const { leaf } = await createCategories();
    const res = await create({ name: 'Too Deep', parent: String(leaf._id) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('parent');
  });

  it('rejects duplicate names at the same level', async () => {
    await create({ name: 'Electronics' });
    const res = await create({ name: 'electronics' });
    expect(res.status).toBe(409);
  });

  it('will not add a subcategory under a category that already has products', async () => {
    const { leaf } = await createCategories();
    const seller = await createSeller('approved');
    await createProduct(seller, leaf._id);

    const res = await create({ name: 'Polos', parent: String(leaf._id) });
    expect([400, 409]).toContain(res.status);
  });

  it('renaming a parent updates subcategory slugs', async () => {
    const { parent, leaf } = await createCategories();
    const res = await request(app)
      .patch(`${API}/admin/categories/${parent._id}`)
      .set(admin.auth)
      .send({ name: 'Apparel' });

    expect(res.status).toBe(200);
    expect(res.body.data.category.slug).toBe('apparel');
    expect((await Category.findById(leaf._id)).slug).toBe('apparel-t-shirts');
  });

  it('lists all categories with product counts', async () => {
    const { leaf } = await createCategories();
    const seller = await createSeller('approved');
    await createProduct(seller, leaf._id);

    const res = await request(app).get(`${API}/admin/categories`).set(admin.auth);
    expect(res.status).toBe(200);
    const tShirts = res.body.data.categories.find((c) => c.slug === 'fashion-t-shirts');
    expect(tShirts.productCount).toBe(1);
  });

  it('refuses to delete a category with subcategories or products', async () => {
    const { parent, leaf } = await createCategories();
    const seller = await createSeller('approved');
    await createProduct(seller, leaf._id);

    expect((await request(app).delete(`${API}/admin/categories/${parent._id}`).set(admin.auth)).status).toBe(409);
    expect((await request(app).delete(`${API}/admin/categories/${leaf._id}`).set(admin.auth)).status).toBe(409);
  });

  it('deletes an empty category', async () => {
    const { inactive } = await createCategories();
    const res = await request(app).delete(`${API}/admin/categories/${inactive._id}`).set(admin.auth);

    expect(res.status).toBe(200);
    expect(await Category.findById(inactive._id)).toBeNull();
  });

  it('is admin only', async () => {
    const seller = await createSeller('approved');
    const res = await request(app).post(`${API}/admin/categories`).set(seller.auth).send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });
});

describe('Public: category tree', () => {
  it('returns active categories nested under their parent', async () => {
    await createCategories();
    const res = await request(app).get(`${API}/categories`);

    expect(res.status).toBe(200);
    const [fashion] = res.body.data.categories;
    expect(fashion.slug).toBe('fashion');
    expect(fashion.children.map((c) => c.slug)).toEqual(['fashion-t-shirts']); // inactive one hidden
  });

  it('hides children of an inactive parent', async () => {
    const { parent } = await createCategories();
    await Category.updateOne({ _id: parent._id }, { isActive: false });

    const res = await request(app).get(`${API}/categories`);
    expect(res.body.data.categories).toEqual([]);
  });
});
